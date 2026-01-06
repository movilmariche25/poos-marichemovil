
"use client";

import { PageHeader } from "@/components/page-header";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { DollarSign, Package, Wrench, AlertCircle, Calculator } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { format as formatDate } from "date-fns";
import dynamic from "next/dynamic";
import { useCurrency } from "@/hooks/use-currency";
import type { Product, RepairJob, Sale } from "@/lib/types";
import { collection } from "firebase/firestore";
import { useMemo, useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const MonthlyActivityOverview = dynamic(
    () => import('@/components/dashboard/monthly-activity-overview').then(mod => mod.MonthlyActivityOverview),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-[450px] flex items-center justify-center">
                <Skeleton className="w-full h-full" />
            </div>
        )
    }
);


export default function DashboardPage() {
    const { firestore } = useFirebase();
    const { format: formatCurrency, getSymbol } = useCurrency();
    
    const productsCollection = useMemoFirebase(() => 
      firestore ? collection(firestore, "products") : null,
      [firestore]
    );
    const { data: products, isLoading: productsLoading } = useCollection<Product>(productsCollection);

    const repairJobsCollection = useMemoFirebase(() =>
        firestore ? collection(firestore, "repair_jobs") : null,
        [firestore]
    );
    const { data: repairJobs, isLoading: repairsLoading } = useCollection<RepairJob>(repairJobsCollection);

    const salesCollection = useMemoFirebase(() =>
        firestore ? collection(firestore, "sale_transactions") : null,
        [firestore]
    );
    const { data: sales, isLoading: salesLoading } = useCollection<Sale>(salesCollection);

    const {
        openSalesToday,
        openSalesTotal,
        totalRevenueToday,
        totalRevenueToClose
    } = useMemo(() => {
        if (!sales) return { openSalesToday: [], openSalesTotal: [], totalRevenueToday: 0, totalRevenueToClose: 0 };
        
        const openSales = sales.filter(s => s.status !== 'refunded' && !s.reconciliationId);
        const todayStr = formatDate(new Date(), 'yyyy-MM-dd');
        const todaySales = openSales.filter(s => formatDate(new Date(s.transactionDate), 'yyyy-MM-dd') === todayStr);
        const totalRevenueToday = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
        const totalRevenueToClose = openSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
        
        return {
            openSalesToday: todaySales,
            openSalesTotal: openSales,
            totalRevenueToday,
            totalRevenueToClose
        }

    }, [sales]);


    const isLoading = productsLoading || repairsLoading || salesLoading;

    const lowStockCount = products?.filter(p => p.stockLevel > 0 && p.stockLevel <= p.lowStockThreshold).length || 0;
    
    const openRepairs = repairJobs?.filter(r => r.status !== 'Completado' && r.status !== 'Listo para recoger').length || 0;

    return (
        <>
            <PageHeader title="Panel de control" />
            <main className="flex-1 p-4 sm:p-6 space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <StatCard 
                        title="Ventas Abiertas (Hoy)"
                        value={`${getSymbol()}${formatCurrency(totalRevenueToday)}`}
                        icon={<DollarSign className="w-4 h-4" />}
                        description={`${openSalesToday.length} ventas hoy sin cerrar`}
                        href="/dashboard/reports"
                        isLoading={isLoading}
                    />
                    <StatCard 
                        title="Total por Cerrar"
                        value={`${getSymbol()}${formatCurrency(totalRevenueToClose)}`}
                        icon={<Calculator className="w-4 h-4" />}
                        description={`${openSalesTotal.length} ventas totales sin cerrar`}
                        href="/dashboard/reports"
                        isLoading={isLoading}
                    />
                    <StatCard 
                        title="Reparaciones abiertas"
                        value={openRepairs}
                        icon={<Wrench className="w-4 h-4" />}
                        description={`${repairJobs?.length || 0} trabajos totales`}
                        href="/dashboard/repairs"
                        isLoading={isLoading}
                    />
                    <StatCard 
                        title="Artículos de inventario"
                        value={products?.length || 0}
                        icon={<Package className="w-4 h-4" />}
                        description="Productos únicos totales"
                        href="/dashboard/inventory"
                        isLoading={isLoading}
                    />
                    <StatCard 
                        title="Stock bajo"
                        value={lowStockCount}
                        icon={<AlertCircle className="w-4 h-4" />}
                        description="Artículos que necesitan reordenarse"
                        href="/dashboard/inventory?filter=low-stock"
                        isLoading={isLoading}
                    />
                </div>
                <div className="grid gap-6">
                    <MonthlyActivityOverview sales={sales || []} repairJobs={repairJobs || []} isLoading={isLoading} />
                </div>
            </main>
        </>
    )
}

