
"use client";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { MonthlyActivityOverview } from "@/components/dashboard/monthly-activity-overview";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { Sale, RepairJob } from "@/lib/types";
import { useMemo } from "react";
import { Wrench, ShoppingCart, DollarSign, Package } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { isToday, isThisWeek, startOfWeek } from "date-fns";

export default function DashboardPage() {
    const { firestore } = useFirebase();
    const { format: formatCurrency, getSymbol, isLoading: currencyIsLoading } = useCurrency();

    // Fetch all sales and repair jobs
    const salesCollection = useMemoFirebase(() => 
        firestore ? collection(firestore, "sale_transactions") : null, 
        [firestore]
    );
    const { data: sales, isLoading: salesLoading } = useCollection<Sale>(salesCollection);

    const repairJobsCollection = useMemoFirebase(() =>
        firestore ? collection(firestore, "repair_jobs") : null,
        [firestore]
    );
    const { data: repairJobs, isLoading: repairsLoading } = useCollection<RepairJob>(repairJobsCollection);

    const {
        todaySalesCount,
        todaySalesTotal,
        todayRepairsCount,
    } = useMemo(() => {
        if (!sales || !repairJobs) {
            return {
                todaySalesCount: 0,
                todaySalesTotal: 0,
                todayRepairsCount: 0,
            };
        }

        const today = new Date();

        const todaySales = sales.filter(s => s.transactionDate && isToday(new Date(s.transactionDate)) && s.status !== 'refunded');
        const todayRepairs = repairJobs.filter(r => r.createdAt && isToday(new Date(r.createdAt)));
        
        const todaySalesTotal = todaySales.reduce((acc, s) => acc + s.totalAmount, 0);

        return {
            todaySalesCount: todaySales.length,
            todaySalesTotal,
            todayRepairsCount: todayRepairs.length,
        };

    }, [sales, repairJobs]);

    const isLoading = salesLoading || repairsLoading || currencyIsLoading;

    return (
        <>
            <PageHeader title="Panel de Control" />
            <main className="flex-1 p-4 sm:p-6 space-y-6">
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <StatCard 
                        title="Ventas de Hoy"
                        value={`${getSymbol()}${formatCurrency(todaySalesTotal)}`}
                        description={`${todaySalesCount} transacciones`}
                        icon={<ShoppingCart />}
                        href="/dashboard/reports"
                        isLoading={isLoading}
                    />
                     <StatCard 
                        title="Reparaciones Registradas Hoy"
                        value={todayRepairsCount}
                        description="Nuevos trabajos en el taller"
                        icon={<Wrench />}
                        href="/dashboard/repairs"
                        isLoading={isLoading}
                    />
                </div>
                <div className="grid grid-cols-1">
                    <MonthlyActivityOverview 
                        sales={sales || []} 
                        repairJobs={repairJobs || []} 
                        isLoading={isLoading}
                    />
                </div>
            </main>
        </>
    );
}
