
"use client";

import React, { Suspense, useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PlusCircle, Trash2, Calculator } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { columns } from "@/components/inventory/columns";
import { ProductFormDialog } from "@/components/inventory/product-form-dialog";
import type { Product } from '@/lib/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';
import type { Table as TanstackTable } from '@tanstack/react-table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { AdminAuthDialog } from '@/components/admin-auth-dialog';
import { PrintLabelsButton } from '@/components/inventory/print-labels-button';
import { PriceCalculatorDialog } from '@/components/tools/price-calculator-dialog';

function BulkDeleteButton({ table }: { table: TanstackTable<Product> }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const selectedRows = table.getSelectedRowModel().rows;

    const handleDelete = async () => {
        if (!firestore || selectedRows.length === 0) return;

        const batch = writeBatch(firestore);
        selectedRows.forEach(row => {
            const productRef = doc(firestore, 'products', row.original.id!);
            batch.delete(productRef);
        });

        try {
            await batch.commit();
            toast({
                title: "Productos Eliminados",
                description: `${selectedRows.length} productos han sido eliminados del inventario.`,
            });
            table.resetRowSelection();
        } catch (error) {
            console.error("Error al eliminar productos en lote:", error);
            toast({
                variant: "destructive",
                title: "Error al Eliminar",
                description: "No se pudieron eliminar los productos seleccionados.",
            });
        } finally {
            setIsConfirmOpen(false);
        }
    };
    
    const handleAuthorized = () => {
        setIsConfirmOpen(true);
    }

    return (
        <AdminAuthDialog onAuthorized={handleAuthorized}>
            <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                 <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={selectedRows.length === 0}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar ({selectedRows.length})
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Esto eliminará permanentemente {selectedRows.length} producto(s) de tu inventario.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                            Sí, eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AdminAuthDialog>
    );
}

// Client component to handle searchParams and state
function InventoryContent() {
    const { firestore } = useFirebase();
    const productsCollection = useMemoFirebase(() =>
        firestore ? collection(firestore, 'products') : null,
        [firestore]
    );
    const { data: products, isLoading } = useCollection<Product>(productsCollection);

    const searchParams = useSearchParams();
    const lowStockFilter = searchParams.get('filter') === 'low-stock';
    const initialFilter: StockFilter = lowStockFilter ? 'low' : 'all';

    const [stockFilter, setStockFilter] = useState<StockFilter>(initialFilter);

    const getAvailableStock = (product: Product, allProducts: Product[]): number => {
        if (product.isCombo) {
            if (!product.comboItems || product.comboItems.length === 0) return 0;
            const stockCounts = product.comboItems.map(item => {
                const component = allProducts.find(p => p.id === item.productId);
                if (!component) return 0;
                const available = component.stockLevel - (component.reservedStock || 0);
                return Math.floor(available / item.quantity);
            });
            return Math.min(...stockCounts);
        }
        return product.stockLevel - (product.reservedStock || 0);
    };

    const filteredProducts = useMemo(() => {
        if (!products) return [];
        if (stockFilter === 'all') {
            return products;
        }

        return products.filter(p => {
            const availableStock = getAvailableStock(p, products);
            if (stockFilter === 'low') {
                return availableStock > 0 && availableStock <= p.lowStockThreshold;
            }
            if (stockFilter === 'out') {
                return availableStock <= 0;
            }
            return true;
        });

    }, [products, stockFilter]);

    return (
        <>
            <PageHeader title="Inventario">
                 <PriceCalculatorDialog>
                    <Button variant="outline" size="icon">
                        <Calculator className="h-4 w-4" />
                    </Button>
                </PriceCalculatorDialog>
                <ProductFormDialog productCount={products?.length || 0}>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Añadir Producto
                    </Button>
                </ProductFormDialog>
            </PageHeader>
            <main className="flex-1 p-4 sm:p-6">
                <Tabs value={stockFilter} onValueChange={(value) => setStockFilter(value as StockFilter)} className="mb-4">
                    <TabsList>
                        <TabsTrigger value="all">Todos</TabsTrigger>
                        <TabsTrigger value="low">Stock Bajo</TabsTrigger>
                        <TabsTrigger value="out">Sin Stock</TabsTrigger>
                    </TabsList>
                </Tabs>
                <DataTable 
                    columns={columns} 
                    data={filteredProducts}
                    isLoading={isLoading}
                    filterPlaceholder="Buscar por SKU, nombre, categoría, modelo..."
                    globalFilterFn={(row, columnId, filterValue) => {
                        const product = row.original;
                        const searchTerm = filterValue.toLowerCase();
                        
                        const nameMatch = product.name.toLowerCase().includes(searchTerm);
                        const skuMatch = product.sku.toLowerCase().includes(searchTerm);
                        const categoryMatch = product.category.toLowerCase().includes(searchTerm);
                        const modelMatch = product.compatibleModels?.some(model => model.toLowerCase().includes(searchTerm)) || false;

                        return nameMatch || skuMatch || categoryMatch || modelMatch;
                    }}
                    meta={{ allProducts: products || [] }} // Pass all products to meta for combo calculations
                >
                    {(table) => (
                        <div className="flex items-center gap-2">
                            <PrintLabelsButton table={table} />
                            <BulkDeleteButton table={table} />
                        </div>
                    )}
                </DataTable>
            </main>
        </>
    );
}

type StockFilter = 'all' | 'low' | 'out';

function Page() {
  return (
    <Suspense fallback={<div>Cargando inventario...</div>}>
      <InventoryContent />
    </Suspense>
  )
}

export default Page;

