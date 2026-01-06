
"use client"

import type { ColumnDef } from "@tanstack/react-table"
import type { Product } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowUpDown, MoreHorizontal, Edit, Trash2, TicketPercent } from "lucide-react"
import { Badge } from "../ui/badge"
import { ProductFormDialog } from "./product-form-dialog"
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
import { useCurrency } from "@/hooks/use-currency"
import { useFirebase, deleteDocumentNonBlocking } from "@/firebase"
import { doc } from "firebase/firestore"
import { AdminAuthDialog } from "../admin-auth-dialog"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Checkbox } from "../ui/checkbox"

const ActionsCell = ({ product }: { product: Product }) => {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);


    const handleDelete = () => {
        if (!firestore || !product.id) return;
        const productRef = doc(firestore, 'products', product.id);
        deleteDocumentNonBlocking(productRef);
        toast({
            title: "Producto Eliminado",
            description: `${product.name} ha sido eliminado del inventario.`,
            variant: "destructive"
        })
        setIsDeleteDialogOpen(false);
    }
    
    const handleTriggerEdit = () => {
        // This is a bit of a hack to programmatically click the trigger
        // because the AdminAuthDialog consumes the click event.
        document.getElementById(`edit-trigger-${product.id}`)?.click();
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
                    <AdminAuthDialog onAuthorized={handleTriggerEdit}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
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
            <ProductFormDialog product={product}>
                <button id={`edit-trigger-${product.id}`} style={{ display: 'none' }}></button>
            </ProductFormDialog>


            {/* Alert for deleting */}
             <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                 <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta acción no se puede deshacer. Esto eliminará permanentemente el producto
                        <span className="font-semibold"> {product.name}</span>.
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

export const columns: ColumnDef<Product>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Seleccionar todo"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Seleccionar fila"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "sku",
    header: "SKU",
  },
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Nombre
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
        const product = row.original;
        const compatibleModels = product.compatibleModels || [];
        return (
            <div className="max-w-xs">
                <div className="font-medium">{product.name}</div>
                {compatibleModels.length > 0 && (
                    <div className="text-xs text-muted-foreground truncate" title={compatibleModels.join(', ')}>
                        Compatible: {compatibleModels.join(', ')}
                    </div>
                )}
            </div>
        )
    }
  },
  {
    accessorKey: "category",
    header: "Categoría",
  },
  {
    accessorKey: "stockLevel",
    header: ({ column }) => (
        <div className="text-center">
            <Button
                variant="ghost"
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
                Stock Total
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        </div>
    ),
    cell: ({ row }) => {
        const stock: number = row.getValue("stockLevel");
        return <div className="text-center"><Badge variant="secondary">{stock}</Badge></div>
    }
  },
  {
    accessorKey: "reservedStock",
    header: () => <div className="text-center">Reservado</div>,
    cell: ({ row }) => {
        const reserved = row.original.reservedStock || 0;
        return <div className="text-center"><Badge variant={reserved > 0 ? "outline" : "secondary"}>{reserved}</Badge></div>
    }
  },
  {
    id: 'availableStock',
    header: () => <div className="text-center">Disponible</div>,
    cell: ({ row }) => {
      const stock: number = row.original.stockLevel;
      const reserved: number = row.original.reservedStock || 0;
      const available = stock - reserved;
      const threshold: number = row.original.lowStockThreshold;

      let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
      let className = "";
      if (available <= 0) {
        variant = "destructive"
      } else if (available <= threshold) {
        variant = "outline";
        className = "border-yellow-500 text-yellow-500"
      }

      return <div className="text-center"><Badge variant={variant} className={className}>{available}</Badge></div>
    }
  },
  {
    accessorKey: "damagedStock",
    header: () => <div className="text-center">Dañado</div>,
    cell: ({ row }) => {
        const damaged = row.original.damagedStock || 0;
        return <div className="text-center"><Badge variant={damaged > 0 ? "destructive" : "secondary"}>{damaged}</Badge></div>
    }
  },
  {
    accessorKey: "costPrice",
    header: () => <div className="text-right">Precio de Costo</div>,
    cell: function Cell({ row }) {
        const { format } = useCurrency();
        const amountUSD = parseFloat(row.getValue("costPrice"));
   
        return (
          <div className="text-right">
            <div className="font-medium">${format(amountUSD)}</div>
          </div>
        );
    },
  },
  {
    accessorKey: "retailPrice",
    header: () => <div className="text-right">Precio de Venta</div>,
    cell: function Cell({ row }) {
        const { format, convert, getDynamicPrice } = useCurrency();
        const product = row.original;
        
        const manualOrDynamicPrice = (product.retailPrice && product.retailPrice > 0) 
            ? product.retailPrice 
            : getDynamicPrice(product.costPrice);

        const promoPrice = product.promoPrice;
        const hasPromo = promoPrice && promoPrice > 0;
        
        // El precio de oferta tiene prioridad si está activo
        const displayPrice = hasPromo ? promoPrice : manualOrDynamicPrice;
        
        const amountBs = convert(displayPrice, 'USD', 'Bs');
   
        return (
          <div className="text-right">
            <div className={cn("font-medium", hasPromo && "text-green-600")}>
              {hasPromo && <TicketPercent className="w-3 h-3 inline-block mr-1" />}
              ${format(displayPrice)}
            </div>

            {/* Mostrar el precio de referencia si hay promo y es diferente */}
            {hasPromo && manualOrDynamicPrice !== promoPrice && (
              <div className="text-xs text-muted-foreground line-through">
                Ref: ${format(manualOrDynamicPrice)}
              </div>
            )}
            
            <div className="text-xs text-muted-foreground">
              Bs {format(amountBs, 'Bs')}
            </div>
          </div>
        );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <ActionsCell product={row.original} />,
  },
]

    