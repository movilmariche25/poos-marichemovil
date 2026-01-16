
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { Product, ComboItem } from "@/lib/types";
import { useState, type ReactNode, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useFirebase, setDocumentNonBlocking, addDocumentNonBlocking, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Checkbox } from "../ui/checkbox";
import { Textarea } from "../ui/textarea";
import { useCurrency } from "@/hooks/use-currency";
import { Separator } from "../ui/separator";
import { Info, PackagePlus, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";

const comboItemSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  quantity: z.coerce.number().min(1, "La cantidad debe ser al menos 1."),
});

const formSchema = z.object({
  name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
  category: z.string().min(2, { message: "La categoría es obligatoria." }),
  sku: z.string(),
  costPrice: z.coerce.number().min(0, { message: "El precio de costo debe ser positivo." }),
  hasPromoPrice: z.boolean().optional(),
  promoPrice: z.coerce.number().optional(),
  stockLevel: z.coerce.number().int({ message: "El stock debe ser un número entero." }).min(0, "El stock no puede ser negativo."),
  damagedStock: z.coerce.number().int().min(0).optional(),
  lowStockThreshold: z.coerce.number().int({ message: "El umbral debe ser un número entero." }).min(1, "La alerta debe ser al menos 1."),
  compatibleModels: z.string().optional(),
  isCombo: z.boolean().optional(),
  comboItems: z.array(comboItemSchema).optional(),
  isGiftable: z.boolean().optional(),
});

type ProductFormData = z.infer<typeof formSchema>;

type ProductFormDialogProps = {
  product?: Product;
  children: ReactNode;
  productCount?: number;
};

function generateSku() {
    const datePart = format(new Date(), 'yyMMdd');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    return `SKU-${datePart}-${randomPart}`;
}

export function ProductFormDialog({ product, children, productCount = 0 }: ProductFormDialogProps) {
  const { firestore } = useFirebase();
  const [open, setOpen] = useState(false);
  const [partsPopoverOpen, setPartsPopoverOpen] = useState(false);
  const { toast } = useToast();
  const { getDynamicPrice, convert, format: formatCurrency, getSymbol, profitMargin } = useCurrency();

  const productsCollection = useMemoFirebase(() => firestore ? collection(firestore, 'products') : null, [firestore]);
  const { data: allProducts } = useCollection<Product>(productsCollection);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      category: "",
      sku: "",
      costPrice: 0,
      hasPromoPrice: false,
      promoPrice: 0,
      stockLevel: 1,
      damagedStock: 0,
      lowStockThreshold: 1,
      compatibleModels: "",
      isCombo: false,
      comboItems: [],
      isGiftable: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "comboItems",
  });

  const costPrice = form.watch("costPrice");
  const hasPromo = form.watch("hasPromoPrice");
  const isCombo = form.watch("isCombo");
  const comboItems = form.watch("comboItems");
  const isEditing = !!product;
  
  const comboCost = useMemo(() => {
    if (!isCombo || !comboItems || !allProducts) return 0;
    return comboItems.reduce((total, item) => {
        const productComponent = allProducts.find(p => p.id === item.productId);
        return total + (productComponent ? productComponent.costPrice * item.quantity : 0);
    }, 0);
  }, [isCombo, comboItems, allProducts]);
  
  useEffect(() => {
    if (isCombo) {
        form.setValue("costPrice", comboCost, { shouldValidate: true });
    }
  }, [isCombo, comboCost, form]);


  const calculatedRetailPrice = getDynamicPrice(costPrice);
  const calculatedRetailPriceBs = convert(calculatedRetailPrice, 'USD', 'Bs');
  const suggestedPromoPrice = costPrice * (1 + profitMargin / 100);

   useEffect(() => {
    if(!hasPromo) {
        form.setValue("promoPrice", 0);
    }
  }, [hasPromo, form]);


  useEffect(() => {
    if (open) {
        if (product) {
            form.reset({
              ...product,
              compatibleModels: product.compatibleModels ? product.compatibleModels.join(", ") : "",
              hasPromoPrice: product.promoPrice && product.promoPrice > 0,
              promoPrice: product.promoPrice || 0,
              isCombo: product.isCombo || false,
              comboItems: product.comboItems || [],
              isGiftable: product.isGiftable || false,
              damagedStock: product.damagedStock || 0,
            });
        } else {
            form.reset({
                name: "",
                category: "",
                sku: generateSku(),
                costPrice: 0,
                hasPromoPrice: false,
                promoPrice: 0,
                stockLevel: 1,
                damagedStock: 0,
                lowStockThreshold: 1,
                compatibleModels: "",
                isCombo: false,
                comboItems: [],
                isGiftable: false,
            });
        }
    }
  }, [product, form, open, productCount]);


  async function onSubmit(values: ProductFormData) {
    if (!firestore) return;

    if (values.isCombo && (!values.comboItems || values.comboItems.length === 0)) {
        toast({
            variant: "destructive",
            title: "Error en Combo",
            description: "Un combo debe tener al menos un producto componente."
        });
        return;
    }
    
    const compatibleModelsArray = values.compatibleModels 
      ? values.compatibleModels.split(',').map(s => s.trim()).filter(Boolean)
      : [];
      
    const { hasPromoPrice, ...restOfValues } = values;

    const finalValues: Omit<Product, 'id' | 'retailPrice'> = {
        ...restOfValues,
        compatibleModels: compatibleModelsArray,
        promoPrice: hasPromoPrice ? values.promoPrice : 0,
        reservedStock: product?.reservedStock || 0,
        damagedStock: values.damagedStock || 0,
        comboItems: values.isCombo ? values.comboItems : [],
        costPrice: values.isCombo ? comboCost : values.costPrice,
        isGiftable: values.isGiftable || false,
    };

    if (product && product.id) {
      const productRef = doc(firestore, 'products', product.id);
      setDocumentNonBlocking(productRef, { ...finalValues, id: product.id }, { merge: true });
      toast({ title: "Producto Actualizado", description: `${values.name} ha sido actualizado.` });
    } else {
      const productsCollection = collection(firestore, 'products');
      const newDocRef = doc(productsCollection);
      setDocumentNonBlocking(newDocRef, { ...finalValues, id: newDocRef.id });
      toast({ title: "Producto Añadido", description: `${values.name} ha sido añadido al inventario.` });
    }
    setOpen(false);
    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Producto' : 'Añadir Nuevo Producto'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Actualiza los detalles de este producto.' : 'Rellena los detalles para el nuevo producto.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form 
            onSubmit={form.handleSubmit(onSubmit)} 
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                e.preventDefault();
              }
            }}
            className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Producto</FormLabel>
                  <FormControl>
                    <Input placeholder="ej. Pantalla iPhone 14" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="compatibleModels"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelos Compatibles</FormLabel>
                  <FormControl>
                    <Textarea placeholder="ej. iPhone X, iPhone XS, A2097" {...field} />
                  </FormControl>
                  <FormDescription>Separa los modelos con comas.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <FormControl>
                      <Input placeholder="ej. Pantallas" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder="Automático" {...field} disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
                <FormField
                    control={form.control}
                    name="isCombo"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                                Es un Combo/Paquete
                            </FormLabel>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="isGiftable"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                                Puede ser obsequiado
                            </FormLabel>
                        </FormItem>
                    )}
                />
            </div>

            {isCombo ? (
                 <div className="space-y-4 p-3 border rounded-md">
                    <legend className="text-sm font-medium -mt-1 mb-2">Componentes del Combo</legend>
                    <div className="space-y-2">
                        {fields.map((field, index) => (
                            <div key={field.id} className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                                <span className="flex-1 text-sm">{field.productName}</span>
                                <Input 
                                    type="number" 
                                    {...form.register(`comboItems.${index}.quantity` as const)}
                                    className="w-20 h-8"
                                />
                                <Button type="button" variant="ghost" size="icon" className="w-8 h-8" onClick={() => remove(index)}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                        <Popover open={partsPopoverOpen} onOpenChange={setPartsPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button type="button" variant="outline" className="w-full">
                                    <Search className="mr-2 h-4 w-4" /> Añadir Producto al Combo
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0">
                                <Command>
                                    <CommandInput placeholder="Buscar producto..." />
                                    <CommandList>
                                    <CommandEmpty>No se encontraron productos.</CommandEmpty>
                                    <CommandGroup>
                                        {(allProducts || []).filter(p => !p.isCombo).map((product) => (
                                            <CommandItem
                                                key={product.id}
                                                value={product.name}
                                                onSelect={() => {
                                                    if (!fields.some(f => f.productId === product.id)) {
                                                        append({ productId: product.id!, productName: product.name, quantity: 1 });
                                                    } else {
                                                        toast({ variant: 'destructive', title: 'Producto ya añadido' })
                                                    }
                                                    setPartsPopoverOpen(false);
                                                }}
                                                disabled={fields.some(f => f.productId === product.id)}
                                                className="flex justify-between"
                                            >
                                                <span>{product.name}</span>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            ) : null}


            <div className="space-y-4 p-3 border rounded-md">
                <FormField
                    control={form.control}
                    name="costPrice"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Costo del Producto ($)</FormLabel>
                        <FormControl>
                        <Input 
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            {...field}
                            disabled={isCombo}
                             onChange={e => {
                                const value = e.target.value;
                                const regex = /^[0-9]*\.?[0-9]{0,2}$/;
                                if (regex.test(value)) {
                                    field.onChange(value);
                                }
                            }}
                        />
                        </FormControl>
                        <FormDescription>{isCombo ? "Costo calculado de los componentes." : "Este es el costo base para los cálculos de precios."}</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <div className="p-3 rounded-md bg-muted/50 text-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <Info className="w-4 h-4 text-muted-foreground"/>
                        <p className="font-semibold">Precio de Venta Dinámico (Sugerido)</p>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Precio en Dólares (BCV):</span>
                        <span className="font-bold">{getSymbol('USD')}{formatCurrency(calculatedRetailPrice, 'USD')}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">Precio en Bolívares:</span>
                        <span className="font-bold">{getSymbol('Bs')}{formatCurrency(calculatedRetailPriceBs, 'Bs')}</span>
                    </div>
                </div>

                <Separator />
                
                <FormField
                    control={form.control}
                    name="hasPromoPrice"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0 pt-2">
                             <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                                ¿Tiene Precio de Oferta en Efectivo?
                            </FormLabel>
                        </FormItem>
                    )}
                />
                {hasPromo && (
                    <FormField
                        control={form.control}
                        name="promoPrice"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Precio Oferta en Efectivo ($)</FormLabel>
                            <FormControl>
                            <Input 
                                type="text"
                                inputMode="decimal"
                                {...field}
                            />
                            </FormControl>
                             <FormDescription>
                                Sugerido: <span className="font-semibold">{getSymbol('USD')}{formatCurrency(suggestedPromoPrice, 'USD')}</span> (Costo + {profitMargin}% de ganancia).
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="stockLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock Actual</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} disabled={isCombo}/>
                    </FormControl>
                    {isCombo && <FormDescription>El stock de un combo se basa en sus componentes.</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="damagedStock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock Dañado</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value) || 0)} disabled={isCombo}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="lowStockThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alerta de Stock Bajo</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">{isEditing ? 'Guardar Cambios' : 'Añadir Producto'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
