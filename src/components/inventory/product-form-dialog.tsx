
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import type { Product } from "@/lib/types";
import { useState, type ReactNode, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useFirebase, setDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Checkbox } from "../ui/checkbox";
import { Textarea } from "../ui/textarea";
import { useCurrency } from "@/hooks/use-currency";
import { Separator } from "../ui/separator";
import { Info } from "lucide-react";
import { format } from "date-fns";

const formSchema = z.object({
  name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
  category: z.string().min(2, { message: "La categoría es obligatoria." }),
  sku: z.string(),
  costPrice: z.coerce.number().min(0, { message: "El precio de costo debe ser positivo." }),
  retailPrice: z.coerce.number().optional(), // Campo para anulación manual
  hasPromoPrice: z.boolean().optional(),
  promoPrice: z.coerce.number().optional(),
  stockLevel: z.coerce.number().int({ message: "El stock debe ser un número entero." }).min(1, "El stock debe ser al menos 1."),
  lowStockThreshold: z.coerce.number().int({ message: "El umbral debe ser un número entero." }).min(1, "La alerta debe ser al menos 1."),
  compatibleModels: z.string().optional(),
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
  const { toast } = useToast();
  const { getDynamicPrice, convert, format: formatCurrency, getSymbol, profitMargin } = useCurrency();

  const form = useForm<ProductFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      category: "",
      sku: "",
      costPrice: 0,
      retailPrice: 0,
      hasPromoPrice: false,
      promoPrice: 0,
      stockLevel: 1,
      lowStockThreshold: 1,
      compatibleModels: "",
    },
  });

  const costPrice = form.watch("costPrice");
  const hasPromo = form.watch("hasPromoPrice");
  const isEditing = !!product;

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
              retailPrice: product.retailPrice || 0,
            });
        } else {
            form.reset({
                name: "",
                category: "",
                sku: generateSku(),
                costPrice: 0,
                retailPrice: 0,
                hasPromoPrice: false,
                promoPrice: 0,
                stockLevel: 1,
                lowStockThreshold: 1,
                compatibleModels: "",
            });
        }
    }
  }, [product, form, open, productCount]);


  async function onSubmit(values: ProductFormData) {
    if (!firestore) return;

    const compatibleModelsArray = values.compatibleModels 
      ? values.compatibleModels.split(',').map(s => s.trim()).filter(Boolean)
      : [];
      
    const { hasPromoPrice, ...restOfValues } = values;

    const finalValues: Omit<Product, 'id'> = {
        ...restOfValues,
        compatibleModels: compatibleModelsArray,
        promoPrice: hasPromoPrice ? values.promoPrice : 0,
        // Si retailPrice es 0 o nulo, se guarda como 0 para indicar que se debe usar el cálculo dinámico
        retailPrice: values.retailPrice || 0,
        reservedStock: product?.reservedStock || 0,
        damagedStock: product?.damagedStock || 0,
    }

    if (product && product.id) {
      const productRef = doc(firestore, 'products', product.id);
      setDocumentNonBlocking(productRef, { ...finalValues, id: product.id }, { merge: true });
      toast({ title: "Producto Actualizado", description: `${values.name} ha sido actualizado.` });
    } else {
      const productsCollection = collection(firestore, 'products');
      const newDocRef = await addDocumentNonBlocking(productsCollection, finalValues);
      if(newDocRef) {
        // Optionally update the new document with its own ID
        setDocumentNonBlocking(newDocRef, { id: newDocRef.id }, { merge: true });
      }
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
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
                             onChange={e => {
                                const value = e.target.value;
                                const regex = /^[0-9]*\.?[0-9]{0,2}$/;
                                if (regex.test(value)) {
                                    field.onChange(value);
                                }
                            }}
                        />
                        </FormControl>
                        <FormDescription>Este es el costo base para los cálculos de precios.</FormDescription>
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
                    name="retailPrice"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Precio de Venta Manual ($)</FormLabel>
                        <FormControl>
                        <Input 
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            {...field}
                        />
                        </FormControl>
                        <FormDescription>Opcional. Anula el precio dinámico si es mayor a 0.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />

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
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
            </div>
            <DialogFooter>
              <Button type="submit">{isEditing ? 'Guardar Cambios' : 'Añadir Producto'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    