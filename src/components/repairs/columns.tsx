
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
import { ArrowUpDown, MoreHorizontal, Edit, Trash2, DollarSign, Printer } from "lucide-react"
import { Badge } from "../ui/badge"
import { RepairFormDialog } from "./repair-form-dialog"
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
import { useFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking, useCollection, useMemoFirebase } from "@/firebase"
import { doc, writeBatch, getDoc } from "firebase/firestore"
import { handlePrintTicket } from "./repair-ticket"
import { PayRepairButton } from "./pay-repair-button"
import { AdminAuthDialog } from "../admin-auth-dialog"
import { useState } from "react"

const statusColors: Record<RepairStatus, "default" | "secondary" | "destructive" | "outline"> = {
    'Pendiente': 'destructive',
    'Diagnóstico': 'outline',
    'En Progreso': 'default',
    'Esperando Piezas': 'destructive',
    'Listo para Recoger': 'default',
    'Completado': 'secondary',
};

const repairStatuses: RepairStatus[] = ['Pendiente', 'Diagnóstico', 'En Progreso', 'Esperando Piezas', 'Listo para Recoger', 'Completado'];


const ActionsCell = ({ repairJob }: { repairJob: RepairJob }) => {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const handleDelete = async () => {
        if (!firestore || !repairJob.id) return;
        
        try {
            const batch = writeBatch(firestore);
            const jobRef = doc(firestore, 'repair_jobs', repairJob.id);

            // Devolver las piezas reservadas al stock
            if (repairJob.reservedParts && repairJob.reservedParts.length > 0) {
                for (const part of repairJob.reservedParts) {
                    const productRef = doc(firestore, 'products', part.productId);
                    const productDoc = await getDoc(productRef);
                    if (productDoc.exists()) {
                        const productData = productDoc.data();
                        const currentReservedStock = productData.reservedStock || 0;
                        const newReservedStock = Math.max(0, currentReservedStock - part.quantity);
                        batch.update(productRef, { reservedStock: newReservedStock });
                    }
                }
            }

            batch.delete(jobRef);
            await batch.commit();

            toast({
                title: "Trabajo de Reparación Eliminado",
                description: `El trabajo para ${repairJob.customerName} ha sido eliminado y las piezas devueltas al inventario.`,
                variant: "destructive"
            });

        } catch (error) {
             toast({
                title: "Error al eliminar",
                description: "No se pudo eliminar el trabajo de reparación. Inténtalo de nuevo.",
                variant: "destructive"
            });
            console.error("Error deleting repair job:", error);
        } finally {
            setIsDeleteDialogOpen(false);
        }
    }
    
    const onPrint = () => {
        handlePrintTicket({ repairJob }, (error) => {
             toast({
                variant: "destructive",
                title: "Error de Impresión",
                description: error,
            })
        });
    }

    const handleEditClick = () => {
        const editTrigger = document.getElementById(`edit-trigger-${repairJob.id}`);
        editTrigger?.click();
    };

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
                    <DropdownMenuItem onSelect={onPrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir Ticket
                    </DropdownMenuItem>
                    
                    <AdminAuthDialog onAuthorized={handleEditClick}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar / Ver Detalles
                        </DropdownMenuItem>
                    </AdminAuthDialog>

                    <DropdownMenuSeparator />
                    <AdminAuthDialog onAuthorized={() => setIsDeleteDialogOpen(true)}>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => e.preventDefault()}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                        </DropdownMenuItem>
                    </AdminAuthDialog>
                </DropdownMenuContent>
            </DropdownMenu>
             {/* Hidden trigger for authorized edit */}
             <RepairFormDialog repairJob={repairJob}>
                <button id={`edit-trigger-${repairJob.id}`} style={{ display: 'none' }}></button>
            </RepairFormDialog>

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
        if (!firestore || !repairJob.id) return;
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
    const variant = statusColors[status] || 'secondary';
    
    let badgeClassName = '';
    if (status === 'Listo para Recoger' && !isPaid) {
        badgeClassName = 'bg-yellow-500 text-black hover:bg-yellow-600';
    } else if (status === 'Completado' && isPaid) {
         badgeClassName = 'bg-green-500 text-white hover:bg-green-600';
    }

    return (
        <Select value={repairJob.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-48 border-0 bg-transparent shadow-none focus:ring-0">
                <SelectValue asChild>
                     <Badge variant={variant} className={badgeClassName}>{repairJob.status}</Badge>
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
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Fecha de Registro
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
        const date = parseISO(row.getValue("createdAt"));
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
  {
    id: 'cobrar',
    cell: ({ row }) => {
        const repairJob = row.original;
        const remainingBalance = repairJob.estimatedCost - (repairJob.amountPaid || 0);
        
        if ((repairJob.status === 'Listo para Recoger' || repairJob.status === 'Completado') && remainingBalance > 0) {
            return <PayRepairButton repairJob={repairJob} />;
        }
        return null;
    }
   },
]

    