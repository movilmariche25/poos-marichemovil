"use client";

import { PageHeader } from "@/components/page-header";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { DollarSign, Package, Wrench, AlertCircle } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { isToday } from "date-fns";
import { MonthlyActivityOverview } from "@/components/dashboard/monthly-activity-overview";
import { useCurrency } from "@/hooks/use-currency";
import type { Product, RepairJob, Sale } from "@/lib/types";
import { collection } from "firebase/firestore";

export default function DashboardPage() {
    const { firestore } = useFirebase();
    const { format, getSymbol } = useCurrency();
    
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

    const validSales = sales?.filter(s => s.status !== 'refunded') || [];
    const todaySales = validSales.filter(s => isToday(new Date(s.transactionDate))) || [];
    const totalRevenueToday = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    
    const lowStockCount = products?.filter(p => p.stockLevel > 0 && p.stockLevel <= p.lowStockThreshold).length || 0;
    
    const openRepairs = repairJobs?.filter(r => r.status !== 'Completado' && r.status !== 'Listo para recoger').length || 0;

    const isLoading = productsLoading || repairsLoading || salesLoading;

    return (
        <>
            <PageHeader title="Panel de control" />
            <main className="flex-1 p-4 sm:p-6 space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard 
                        title="Ingresos de hoy"
                        value={`${getSymbol()}${format(totalRevenueToday)}`}
                        icon={<DollarSign className="w-4 h-4" />}
                        description={`${todaySales.length} ventas hoy`}
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
