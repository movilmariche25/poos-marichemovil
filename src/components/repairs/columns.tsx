

"use client"

import type { ColumnDef } from "@tanstack/react-table"
import type { RepairJob, RepairStatus } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Edit, Trash2, DollarSign, Printer, Eye, ArrowUpDown } from "lucide-react"
import { Badge } from "../ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { format, parseISO, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { useCurrency } from "@/hooks/use-currency"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { useFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase"
import { doc, writeBatch, getDoc, runTransaction } from "firebase/firestore"
import { handlePrintTicket } from "./repair-ticket"
import { AdminAuthDialog } from "../admin-auth-dialog"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { RepairFormDialog } from "./repair-form-dialog"

const statusColors: Record<RepairStatus, "default" | "secondary" | "destructive" | "outline"> = {
    'Pendiente': 'destructive',
    'Completado': 'secondary',
};

const repairStatuses: RepairStatus[] = ['Pendiente', 'Completado'];


const ActionsCell = ({ repairJob }: { repairJob: RepairJob }) => {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const router = useRouter();
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const estimatedCost = repairJob.estimatedCost || 0;
    const amountPaid = repairJob.amountPaid || 0;
    const remainingBalance = estimatedCost - amountPaid;
    const isCompletedAndPaid = repairJob.status === 'Completado' && repairJob.isPaid;

    const handlePay = () => {
        const repairData = encodeURIComponent(JSON.stringify(repairJob));
        router.push(`/dashboard/pos?repairJob=${repairData}`);
    };

    const handleDelete = async () => {
        if (!firestore || !repairJob.id) return;
        
        try {
            await runTransaction(firestore, async (transaction) => {
                const jobRef = doc(firestore, 'repair_jobs', repairJob.id!);

                // Devolver las piezas reservadas al stock
                if (repairJob.reservedParts && repairJob.reservedParts.length > 0) {
                    for (const part of repairJob.reservedParts) {
                        const productRef = doc(firestore, 'products', part.productId);
                        const productDoc = await transaction.get(productRef);
                        if (productDoc.exists()) {
                            const productData = productDoc.data();
                            const currentReservedStock = productData.reservedStock || 0;
                            const newReservedStock = Math.max(0, currentReservedStock - part.quantity);
                            transaction.update(productRef, { reservedStock: newReservedStock });
                        }
                    }
                }

                transaction.delete(jobRef);
            });

            toast({
                title: "Trabajo de Reparación Eliminado",
                description: `El trabajo para ${repairJob.customerName} ha sido eliminado y las piezas devueltas al inventario.`,
                variant: "destructive"
            });

        } catch (error: any) {
             toast({
                title: "Error al eliminar",
                description: error.message || "No se pudo eliminar el trabajo de reparación. Inténtalo de nuevo.",
                variant: "destructive"
            });
            console.error("Error deleting repair job:", error);
        } finally {
            setIsDeleteDialogOpen(false);
        }
    }
    
    const onPrint = (variant: 'client' | 'internal') => {
        handlePrintTicket({ repairJob, variant }, (error) => {
             toast({
                variant: "destructive",
                title: "Error de Impresión",
                description: error,
            })
        });
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Abrir menú</span>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                    
                    {remainingBalance > 0.001 && !repairJob.isPaid && (
                         <DropdownMenuItem onSelect={handlePay} className="text-green-600 focus:text-green-700">
                            <DollarSign className="mr-2 h-4 w-4" />
                            Cobrar
                        </DropdownMenuItem>
                    )}
                    
                    <RepairFormDialog repairJob={repairJob}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                             {isCompletedAndPaid ? <Eye className="mr-2 h-4 w-4" /> : <Edit className="mr-2 h-4 w-4" />}
                            {isCompletedAndPaid ? 'Ver Detalles' : 'Editar / Ver Detalles'}
                        </DropdownMenuItem>
                    </RepairFormDialog>
                    
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Imprimir</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => onPrint('client')}>
                        <Printer className="mr-2 h-4 w-4" />
                        Ticket (Cliente)
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onPrint('internal')}>
                        <Printer className="mr-2 h-4 w-4" />
                        Copia (Interna)
                    </DropdownMenuItem>


                    <DropdownMenuSeparator />
                    <AdminAuthDialog onAuthorized={() => setIsDeleteDialogOpen(true)}>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => e.preventDefault()}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                        </DropdownMenuItem>
                    </AdminAuthDialog>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Alert for deleting */}
             <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esto eliminará permanentemente el trabajo de reparación para <span className="font-semibold">{repairJob.customerName}</span> y devolverá las piezas reservadas al inventario.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
             </AlertDialog>
        </>
    )
}

const StatusCell = ({ repairJob }: { repairJob: RepairJob }) => {
    const { toast } = useToast();
    const { firestore } = useFirebase();

    const handleStatusChange = (newStatus: RepairStatus) => {
        if (!firestore || !repairJob.id || repairJob.status === 'Completado') return;
        const jobRef = doc(firestore, 'repair_jobs', repairJob.id);

        let updateData: Partial<RepairJob> = { status: newStatus };

        const wasCompleted = repairJob.status === 'Completado';
        const isNowCompleted = newStatus === 'Completado';
        
        if (isNowCompleted && !wasCompleted) {
            const completionDate = new Date();
            updateData.completedAt = completionDate.toISOString();
            updateData.warrantyEndDate = addDays(completionDate, 4).toISOString();
             toast({
                title: 'Trabajo Completado y Garantía Iniciada',
                description: `La garantía de 4 días para la reparación de ${repairJob.customerName} ha comenzado.`,
            });
        }

        updateDocumentNonBlocking(jobRef, updateData);
        toast({
            title: 'Estado Actualizado',
            description: `El estado de la reparación de ${repairJob.customerName} es ahora "${newStatus}".`
        });
    }

    const status: RepairStatus = repairJob.status;
    const isPaid = repairJob.isPaid;
    
    let badgeVariant: "default" | "secondary" | "destructive" | "outline" = 'secondary';
    let badgeClassName = '';

    if (status === 'Completado') {
        badgeVariant = 'secondary';
        if (isPaid) {
            badgeClassName = 'bg-green-500 text-white hover:bg-green-600';
        }
    } else { // Pendiente
        badgeVariant = 'destructive';
    }
    
    if (status === 'Completado') {
        return <Badge variant={badgeVariant} className={cn(badgeClassName)}>{repairJob.isPaid ? 'Completado y Pagado' : 'Completado'}</Badge>;
    }


    return (
        <Select value={repairJob.status} onValueChange={handleStatusChange} disabled={repairJob.status === 'Completado'}>
            <SelectTrigger className="w-48 border-0 bg-transparent shadow-none focus:ring-0">
                <SelectValue asChild>
                     <Badge variant={badgeVariant} className={cn(badgeClassName, "cursor-pointer")}>{repairJob.status}</Badge>
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {repairStatuses.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

export const columns: ColumnDef<RepairJob>[] = [
  {
    accessorKey: "id",
    header: "ID de Trabajo",
    cell: ({ row }) => <div className="font-mono text-xs text-muted-foreground">{row.original.id}</div>,
  },
  {
    accessorKey: "customerName",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Cliente
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div className="font-medium">{row.getValue("customerName")}</div>
  },
  {
    accessorKey: "device",
    header: "Dispositivo",
    cell: ({ row }) => `${row.original.deviceMake} ${row.original.deviceModel}`,
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => <StatusCell repairJob={row.original} />,
  },
  {
    accessorKey: "createdAt",
    header: "Fecha de Registro",
    cell: ({ row }) => {
        if (!row.getValue("createdAt")) return null;
        const date = parseISO(row.getValue("createdAt") as string);
        return <div>{format(date, 'MMM d, yyyy', { locale: es })}</div>
    }
  },
  {
    accessorKey: "estimatedCost",
    header: () => <div className="text-right">Costo Estimado</div>,
    cell: function Cell({ row }) {
      const { format, getSymbol } = useCurrency();
      const amount = parseFloat(row.getValue("estimatedCost"))
      return <div className="text-right font-medium">{getSymbol()}{format(amount)}</div>
    },
  },
   {
    accessorKey: "amountPaid",
    header: () => <div className="text-right">Pagado</div>,
    cell: function Cell({ row }) {
      const { format, getSymbol } = useCurrency();
      const amount = parseFloat(row.getValue("amountPaid") || 0)
      return <div className="text-right font-medium text-green-600">{getSymbol()}{format(amount)}</div>
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <ActionsCell repairJob={row.original} />,
  },
]
