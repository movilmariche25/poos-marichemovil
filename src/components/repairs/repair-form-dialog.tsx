
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
import type { RepairJob, RepairStatus, Product } from "@/lib/types";
import { useState, useEffect, useMemo, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useCurrency } from "@/hooks/use-currency";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { useFirebase, setDocumentNonBlocking, addDocumentNonBlocking, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, writeBatch, query, where, getDocs, getDoc, runTransaction } from "firebase/firestore";
import { handlePrintTicket } from "./repair-ticket";
import { AlertCircle, Info, Printer, Search, TicketPercent, UserSearch } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { format, addDays } from "date-fns";
import { useDebounce } from "use-debounce";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";


const repairStatuses: RepairStatus[] = ['Pendiente', 'Completado'];
const initialChecklistItems = [
    { id: 'screen_scratched', label: 'Pantalla Rayada' },
    { id: 'screen_broken', label: 'Pantalla Rota' },
    { id: 'back_broken', label: 'Carcasa/Tapa Trasera Rota' },
    { id: 'back_scratched', label: 'Carcasa/Tapa Trasera Rayada' },
    { id: 'no_power', label: 'Equipo No Enciende' },
    { id: 'wet_damage', label: 'Equipo Mojado' },
];

const reservedPartSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  quantity: z.coerce.number().min(1, "La cantidad debe ser al menos 1."),
  costPrice: z.coerce.number().min(0, "El costo debe ser un número positivo.")
});

const formSchema = z.object({
  customerName: z.string().min(2, "El nombre es obligatorio."),
  customerPhone: z.string().min(10, "Se requiere un número de teléfono válido."),
  customerID: z.string().optional(),
  customerAddress: z.string().optional(),
  deviceMake: z.string().min(2, "La marca del dispositivo es obligatoria."),
  deviceModel: z.string().min(1, "El modelo del dispositivo es obligatorio."),
  deviceImei: z.string().optional(),
  reportedIssue: z.string().min(5, "La descripción del problema es obligatoria."),
  initialConditionsChecklist: z.array(z.string()).optional(),
  estimatedCost: z.coerce.number().min(0),
  abono: z.coerce.number().min(0).optional(),
  isPaid: z.boolean(),
  status: z.enum(repairStatuses),
  notes: z.string().optional(),
  reservedParts: z.array(reservedPartSchema).optional(),
});

type RepairFormData = z.infer<typeof formSchema>;

type RepairFormDialogProps = {
  repairJob?: RepairJob | null;
  children: ReactNode;
};

function generateJobId() {
    const date = new Date();
    const datePart = format(date, "yyMMdd");
    const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
    return `R-${datePart}-${randomPart}`;
}

export function RepairFormDialog({ repairJob, children }: RepairFormDialogProps) {
  const { firestore } = useFirebase();
  const [open, setOpen] = useState(false);
  
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  
  const [partsPopoverOpen, setPartsPopoverOpen] = useState(false);
  const [abonoInBs, setAbonoInBs] = useState<number | string>("");


  const { toast } = useToast();
  const { getSymbol, format: formatCurrency, getDynamicPrice, convert } = useCurrency();
  const [warrantyInfo, setWarrantyInfo] = useState<{ message: string; date: string } | null>(null);
  
  const [mainPart, setMainPart] = useState<Product | null>(null);
  const [usePromoPrice, setUsePromoPrice] = useState(false);

  const productsCollection = useMemoFirebase(() => firestore ? collection(firestore, 'products') : null, [firestore]);
  const { data: products } = useCollection<Product>(productsCollection);
  
  const repairsCollection = useMemoFirebase(() => firestore ? collection(firestore, 'repair_jobs') : null, [firestore]);
  const { data: allRepairJobs } = useCollection<RepairJob>(repairsCollection);

  const isReadOnly = repairJob?.status === 'Completado' && repairJob?.isPaid;
  
  const [duplicateIdError, setDuplicateIdError] = useState<string | null>(null);
  
  const form = useForm<RepairFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: "", customerPhone: "", customerID: "", customerAddress: "",
      deviceMake: "", deviceModel: "", deviceImei: "", reportedIssue: "",
      initialConditionsChecklist: [], estimatedCost: 0, abono: 0,
      isPaid: false, status: "Pendiente", notes: "", reservedParts: [],
    },
  });

  const customerIdValue = form.watch('customerID');
  const customerNameValue = form.watch('customerName');
  const [debouncedCustomerId] = useDebounce(customerIdValue, 500);

  useEffect(() => {
    const checkDuplicateId = async () => {
        if (!debouncedCustomerId || !allRepairJobs || (repairJob && debouncedCustomerId === repairJob.customerID)) {
            setDuplicateIdError(null);
            return;
        }

        const duplicate = allRepairJobs.find(
            job => job.customerID === debouncedCustomerId && job.customerName.toLowerCase() !== customerNameValue.toLowerCase()
        );

        if (duplicate) {
            setDuplicateIdError(`Esta cédula ya está registrada a nombre de ${duplicate.customerName}.`);
        } else {
            setDuplicateIdError(null);
        }
    };
    checkDuplicateId();
  }, [debouncedCustomerId, customerNameValue, allRepairJobs, repairJob]);


  const filteredCustomers = useMemo(() => {
    if (!allRepairJobs || !customerSearchQuery) return [];
    
    const customerMap = new Map<string, { name: string; phone: string; id?: string; address?: string }>();
    for (let i = allRepairJobs.length - 1; i >= 0; i--) {
        const job = allRepairJobs[i];
        const searchString = `${job.customerName} ${job.customerPhone} ${job.customerID || ''}`.toLowerCase();
        
        if (job.customerName && searchString.includes(customerSearchQuery.toLowerCase()) && !customerMap.has(job.customerName.toLowerCase())) {
             customerMap.set(job.customerName.toLowerCase(), { 
                name: job.customerName, 
                phone: job.customerPhone,
                id: job.customerID,
                address: job.customerAddress
            });
        }
    }
    return Array.from(customerMap.values());
  }, [allRepairJobs, customerSearchQuery]);


  const imeiValue = form.watch('deviceImei');
  const [debouncedImei] = useDebounce(imeiValue, 500); 

  useEffect(() => {
    if (!mainPart) {
        form.setValue('estimatedCost', 0);
        return;
    }
    
    let price = getDynamicPrice(mainPart.costPrice);
    if (usePromoPrice && mainPart.promoPrice && mainPart.promoPrice > 0) {
        price = mainPart.promoPrice;
    }

    form.setValue('estimatedCost', price);

    form.setValue('reservedParts', [{
        productId: mainPart.id!,
        productName: mainPart.name,
        quantity: 1,
        costPrice: mainPart.costPrice,
    }]);

  }, [mainPart, usePromoPrice, form, getDynamicPrice]);

  useEffect(() => {
    const checkWarranty = async (imei: string) => {
        if (!imei || !repairsCollection || (repairJob && imei === repairJob.deviceImei)) {
            setWarrantyInfo(null);
            return;
        };

        const q = query(
            repairsCollection,
            where("deviceImei", "==", imei),
            where("status", "==", "Completado")
        );
        
        const querySnapshot = await getDocs(q);
        const now = new Date();
        let activeWarranty: { message: string, date: string } | null = null;

        querySnapshot.forEach((doc) => {
            const job = doc.data() as RepairJob;
            if (job.warrantyEndDate) {
                const warrantyEnd = new Date(job.warrantyEndDate);
                if (now < warrantyEnd) {
                    activeWarranty = {
                        message: `Este dispositivo tiene una garantía activa de una reparación anterior (ID: ${job.id}).`,
                        date: `Válida hasta: ${format(warrantyEnd, 'PPP', { locale: es })}`
                    };
                }
            }
        });

        setWarrantyInfo(activeWarranty);
    };
    
    if (debouncedImei) {
        checkWarranty(debouncedImei);
    } else {
        setWarrantyInfo(null);
    }
  }, [debouncedImei, repairsCollection, repairJob]);


  useEffect(() => {
    if (open) {
        setWarrantyInfo(null);
        setMainPart(null);
        setUsePromoPrice(false);
        setAbonoInBs("");
        setCustomerSearchQuery("");
        setIsCustomerSearchOpen(false);
        setDuplicateIdError(null);

        if (repairJob) {
            form.reset({
                ...repairJob,
                customerID: repairJob.customerID ?? "",
                customerAddress: repairJob.customerAddress ?? "",
                deviceImei: repairJob.deviceImei ?? "",
                initialConditionsChecklist: repairJob.initialConditionsChecklist || [],
                notes: repairJob.notes ?? "",
                estimatedCost: repairJob.estimatedCost || 0,
                abono: repairJob.amountPaid || 0, // Map amountPaid to abono
                isPaid: repairJob.isPaid || false,
                reservedParts: repairJob.reservedParts || [],
            });
            if (repairJob.reservedParts && repairJob.reservedParts.length > 0 && products) {
                const mainPartProduct = products.find(p => p.id === repairJob.reservedParts[0].productId);
                setMainPart(mainPartProduct || null);
            }
        } else {
            form.reset({
                customerName: "", customerPhone: "", customerID: "", customerAddress: "",
                deviceMake: "", deviceModel: "", deviceImei: "", reportedIssue: "",
                initialConditionsChecklist: [], estimatedCost: 0, abono: 0,
                isPaid: false, status: "Pendiente", notes: "", reservedParts: [],
            });
        }
    }
  }, [repairJob, form, products, open]);
  
  const onPrint = (job: RepairJob, variant: 'client' | 'internal') => {
    handlePrintTicket({ repairJob: job, variant }, (error) => {
      toast({
        variant: "destructive",
        title: "Error de Impresión",
        description: error,
      });
    });
  };

  async function onSubmit(values: RepairFormData) {
    if (isReadOnly) {
        setOpen(false);
        return;
    }
    if (!firestore) return;

    if (duplicateIdError) {
        toast({
            variant: "destructive",
            title: "Cédula Duplicada",
            description: "Por favor, corrige la cédula o busca al cliente existente."
        });
        return;
    }
    
    if (!values.reservedParts || values.reservedParts.length === 0) {
        toast({
            variant: "destructive",
            title: "Pieza Principal Requerida",
            description: "Debes seleccionar una pieza principal para la reparación antes de guardar."
        });
        return;
    }

    try {
        await runTransaction(firestore, async (transaction) => {
            const oldParts = repairJob?.reservedParts || [];
            const newParts = values.reservedParts || [];

            // Un-reserve old parts that are no longer in the new list
            for (const oldPart of oldParts) {
                if (!newParts.some(p => p.productId === oldPart.productId)) {
                    const productRef = doc(firestore, "products", oldPart.productId);
                    const productDoc = await transaction.get(productRef);
                    if (productDoc.exists()) {
                        const currentReserved = productDoc.data().reservedStock || 0;
                        transaction.update(productRef, { reservedStock: Math.max(0, currentReserved - oldPart.quantity) });
                    }
                }
            }
            
            // Reserve new parts
            for (const newPart of newParts) {
                // Only reserve if it's a new part for this job
                if (!oldParts.some(p => p.productId === newPart.productId)) {
                    const productRef = doc(firestore, "products", newPart.productId);
                    const productDoc = await transaction.get(productRef);
                    if (!productDoc.exists()) throw new Error(`La pieza ${newPart.productName} no se encuentra en el inventario.`);

                    const productData = productDoc.data();
                    const availableStock = productData.stockLevel - (productData.reservedStock || 0);

                    if (availableStock < newPart.quantity) {
                        throw new Error(`Stock insuficiente para "${newPart.productName}". Disponible: ${availableStock}.`);
                    }
                    const currentReserved = productData.reservedStock || 0;
                    transaction.update(productRef, { reservedStock: currentReserved + newPart.quantity });
                }
            }

            const wasCompleted = repairJob?.status === 'Completado';
            const isNowCompleted = values.status === 'Completado';
            let completionData: Partial<RepairJob> = {};

            if (isNowCompleted && !wasCompleted) {
                const completionDate = new Date();
                completionData = {
                    completedAt: completionDate.toISOString(),
                    warrantyEndDate: addDays(completionDate, 4).toISOString()
                };
            }
            
            const amountPaid = values.abono || 0;
            const isPaid = amountPaid >= values.estimatedCost && values.estimatedCost > 0;
            const finalValues = { ...values, amountPaid, isPaid, notes: values.notes || "" };

            if (repairJob) {
                const jobRef = doc(firestore, 'repair_jobs', repairJob.id!);
                transaction.set(jobRef, { ...finalValues, ...completionData }, { merge: true });
            } else {
                const jobId = generateJobId();
                const newJobData = { ...finalValues, id: jobId, createdAt: new Date().toISOString(), ...completionData };
                const jobRef = doc(firestore, 'repair_jobs', jobId);
                transaction.set(jobRef, newJobData);
                
                // Return new job data for printing
                return newJobData;
            }
        }).then((newJobData) => {
            if (newJobData) { // This means it was a new job
                const fullJobData: RepairJob = {
                    ...newJobData,
                    partsCost: 0, 
                    laborCost: 0,
                };
                onPrint(fullJobData, 'client');
                toast({ title: "Trabajo de Reparación Creado", description: `Nuevo trabajo para ${values.customerName} ha sido registrado.` });
            } else { // This means it was an update
                toast({ title: "Trabajo de Reparación Actualizado", description: `El trabajo para ${values.customerName} ha sido actualizado.` });
            }
            setOpen(false);
        });
    } catch (error: any) {
        console.error("Error al guardar la reparación:", error);
        toast({
            variant: "destructive",
            title: "Error al Guardar",
            description: error.message || "No se pudo guardar la reparación. Por favor, inténtalo de nuevo.",
        });
    }
  }
  
  const estimatedCost = form.watch('estimatedCost');
  const abono = form.watch('abono') || 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{repairJob ? (isReadOnly ? 'Ver Detalles de Reparación' : 'Editar Trabajo de Reparación') : 'Registrar Nuevo Trabajo de Reparación'}</DialogTitle>
          <DialogDescription>
            {isReadOnly ? 'Este trabajo ya fue completado y pagado.' : 'Rellena los detalles para el trabajo de reparación.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form 
                onSubmit={form.handleSubmit(onSubmit)} 
                className="space-y-4 max-h-[70vh] overflow-y-auto pr-4"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                        e.preventDefault();
                    }
                }}
            >
                <fieldset disabled={isReadOnly}>
                    <div className="flex justify-between items-center mb-4">
                        <legend className="text-lg font-semibold">Información del Cliente</legend>
                         <div className="flex items-center gap-2">
                            <Popover open={isCustomerSearchOpen} onOpenChange={setIsCustomerSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Button 
                                        type="button" 
                                        variant="outline"
                                        onClick={() => {
                                            const name = form.getValues("customerName");
                                            const phone = form.getValues("customerPhone");
                                            const id = form.getValues("customerID");
                                            setCustomerSearchQuery(`${name} ${phone} ${id}`);
                                        }}
                                    >
                                        <UserSearch className="h-4 w-4 mr-2"/>
                                        Buscar Cliente
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
                                <Command>
                                     <CommandInput
                                        placeholder="Buscar cliente..."
                                        value={customerSearchQuery}
                                        onValueChange={setCustomerSearchQuery}
                                    />
                                    <CommandList>
                                    <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                                    <CommandGroup>
                                        {filteredCustomers.map((customer) => (
                                            <CommandItem
                                                key={customer.phone}
                                                value={`${customer.name} ${customer.phone} ${customer.id || ''}`}
                                                onSelect={() => {
                                                    form.setValue("customerName", customer.name);
                                                    form.setValue("customerPhone", customer.phone);
                                                    form.setValue("customerID", customer.id || "");
                                                    form.setValue("customerAddress", customer.address || "");
                                                    setIsCustomerSearchOpen(false);
                                                }}
                                            >
                                                <div className="flex flex-col">
                                                    <span>{customer.name}</span>
                                                    <span className="text-xs text-muted-foreground">{customer.phone} - {customer.id}</span>
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                    </CommandList>
                                </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="customerName" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nombre</FormLabel>
                                <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="customerPhone" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Teléfono</FormLabel>
                                <FormControl><Input placeholder="0412-123-4567" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="customerID" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Cédula de Identidad</FormLabel>
                                <FormControl><Input placeholder="V-12345678" {...field} /></FormControl>
                                {duplicateIdError ? (
                                    <p className="text-sm font-medium text-destructive">{duplicateIdError}</p>
                                ) : <FormMessage />}
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="customerAddress" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Dirección</FormLabel>
                                <FormControl><Input placeholder="Av. Principal, Edificio..." {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                    </div>
                </fieldset>

                <fieldset className="grid grid-cols-2 gap-4" disabled={isReadOnly}>
                <legend className="text-lg font-semibold mb-4 col-span-2">Información del Dispositivo</legend>
                    <FormField control={form.control} name="deviceMake" render={({ field }) => (
                        <FormItem><FormLabel>Marca</FormLabel><FormControl><Input placeholder="Apple" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="deviceModel" render={({ field }) => (
                        <FormItem><FormLabel>Modelo</FormLabel><FormControl><Input placeholder="iPhone 14 Pro" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="deviceImei" render={({ field }) => (
                        <FormItem className="col-span-2"><FormLabel>IMEI / Serie (Opcional)</FormLabel><FormControl><Input placeholder="123456789012345" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    {warrantyInfo && (
                        <Alert variant="destructive" className="col-span-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>¡Dispositivo en Garantía!</AlertTitle>
                            <AlertDescription>
                                {warrantyInfo.message}<br />
                                <span className="font-semibold">{warrantyInfo.date}</span>
                            </AlertDescription>
                        </Alert>
                    )}
                </fieldset>
                
                <FormField control={form.control} name="reportedIssue" render={({ field }) => (
                    <FormItem><FormLabel>Problema Reportado</FormLabel><FormControl><Textarea placeholder="Describe el problema..." {...field} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>
                )}/>

                <fieldset disabled={isReadOnly}>
                    <legend className="text-lg font-semibold mb-4 col-span-2">Checklist de Inspección Inicial</legend>
                    <FormField
                        control={form.control}
                        name="initialConditionsChecklist"
                        render={() => (
                            <FormItem className="grid grid-cols-2 gap-x-4 gap-y-2">
                                {initialChecklistItems.map((item) => (
                                    <FormField
                                        key={item.id}
                                        control={form.control}
                                        name="initialConditionsChecklist"
                                        render={({ field }) => {
                                            return (
                                            <FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value?.includes(item.label)}
                                                        onCheckedChange={(checked) => {
                                                            return checked
                                                            ? field.onChange([...(field.value || []), item.label])
                                                            : field.onChange(
                                                                field.value?.filter(
                                                                    (value) => value !== item.label
                                                                )
                                                                )
                                                        }}
                                                    />
                                                </FormControl>
                                                <FormLabel className="font-normal">{item.label}</FormLabel>
                                            </FormItem>
                                            )
                                        }}
                                    />
                                ))}
                            </FormItem>
                        )}
                    />
                </fieldset>
                
                <fieldset className="space-y-4" disabled={isReadOnly}>
                    <legend className="text-lg font-semibold mb-4 col-span-2">Costos y Estado</legend>
                    <div>
                        <Label>Pieza Principal de la Reparación</Label>
                        <Popover open={partsPopoverOpen} onOpenChange={setPartsPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button type="button" variant="outline" className="w-full justify-start text-left font-normal mt-1" disabled={isReadOnly}>
                                    {mainPart ? mainPart.name : "Seleccionar pieza principal..."}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0">
                                <Command>
                                    <CommandInput placeholder="Buscar pieza..." />
                                    <CommandList>
                                    <CommandEmpty>No se encontraron piezas.</CommandEmpty>
                                    <CommandGroup>
                                        {(products || []).map((product) => {
                                            const availableStock = product.stockLevel - (product.reservedStock || 0);
                                            return (
                                                <CommandItem
                                                    key={product.id}
                                                    value={product.name}
                                                    onSelect={() => {
                                                        setMainPart(product);
                                                        setUsePromoPrice(false); // Reset promo on new part selection
                                                        setPartsPopoverOpen(false);
                                                    }}
                                                    disabled={availableStock <= 0}
                                                    className="flex justify-between"
                                                >
                                                    <span>{product.name}</span>
                                                    <span className="text-xs text-muted-foreground">Disp: {availableStock}</span>
                                                </CommandItem>
                                            )
                                        })}
                                    </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="col-span-2 flex items-end gap-2">
                        <div className="flex-1">
                            <Label>Costo Total Estimado ({getSymbol()})</Label>
                            <Input value={formatCurrency(estimatedCost)} disabled className="font-bold text-lg h-12 mt-1" />
                             <FormDescription>
                                o ~Bs {formatCurrency(convert(estimatedCost, 'USD', 'Bs'), 'Bs')}
                            </FormDescription>
                        </div>
                        {mainPart && mainPart.promoPrice && mainPart.promoPrice > 0 && (
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="icon" 
                                onClick={() => setUsePromoPrice(!usePromoPrice)}
                                className={cn("w-12 h-12", usePromoPrice && "bg-green-100 border-green-600 text-green-600 hover:bg-green-200")}
                                disabled={isReadOnly}
                            >
                                <TicketPercent />
                            </Button>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                         <FormField control={form.control} name="abono" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Abono ({getSymbol()})</FormLabel>
                                <FormControl>
                                    <Input 
                                        type="number" 
                                        step="0.01" 
                                        {...field}
                                        onChange={(e) => {
                                            const usdValue = parseFloat(e.target.value) || 0;
                                            field.onChange(usdValue);
                                            const bsValue = convert(usdValue, 'USD', 'Bs');
                                            setAbonoInBs(bsValue > 0 ? bsValue.toFixed(2) : "");
                                        }}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <div>
                            <Label>Abono (Bs)</Label>
                             <Input 
                                type="number" 
                                step="0.01" 
                                value={abonoInBs}
                                onChange={(e) => {
                                    const bsValue = parseFloat(e.target.value) || 0;
                                    setAbonoInBs(e.target.value);
                                    const usdValue = convert(bsValue, 'Bs', 'USD');
                                    form.setValue('abono', parseFloat(usdValue.toFixed(2)));
                                }}
                            />
                        </div>
                    </div>

                     <div className="text-sm text-destructive font-semibold text-right p-2 bg-muted rounded-md flex items-center justify-between">
                        <span>Saldo Pendiente:</span>
                        <span>{getSymbol()}{Math.max(0, estimatedCost - abono).toFixed(2)}</span>
                    </div>

                    <FormField control={form.control} name="status" render={({ field }) => (
                        <FormItem><FormLabel>Estado</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={repairJob?.status === 'Completado'}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar estado" /></SelectTrigger></FormControl>
                                <SelectContent>{repairStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                        <FormMessage /></FormItem>
                    )}/>
                </fieldset>
                <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem><FormLabel>Notas Internas</FormLabel><FormControl><Textarea placeholder="Añade cualquier nota interna..." {...field} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>
                )}/>
                <DialogFooter>
                    {repairJob && !isReadOnly && (
                        <div className="flex gap-2">
                             <Button type="button" variant="outline" onClick={() => onPrint(repairJob, 'internal')}>
                                <Printer className="mr-2 h-4 w-4" />
                                Imprimir (Interna)
                            </Button>
                            <Button type="button" variant="outline" onClick={() => onPrint(repairJob, 'client')}>
                                <Printer className="mr-2 h-4 w-4" />
                                Imprimir (Cliente)
                            </Button>
                        </div>
                    )}
                    <Button type="submit">{isReadOnly ? 'Cerrar' : (repairJob ? 'Guardar Cambios' : 'Registrar y Imprimir Ticket')}</Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
