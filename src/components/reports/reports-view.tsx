

"use client"

import type { Product, Sale, DailyReconciliation, RepairJob } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { TransactionList } from "./transaction-list"
import { isThisWeek, format as formatDate, isToday } from "date-fns"
import { useCurrency } from "@/hooks/use-currency"
import { Skeleton } from "../ui/skeleton"
import { ExportSalesButton } from "./export-sales-button"
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase"
import { useMemo } from "react"
import { collection } from "firebase/firestore"
import { CashReconciliationDialog } from "./cash-reconciliation-dialog"
import { ReconciliationHistory } from "./reconciliation-history"
import { RepairAnalysis } from "./repair-analysis"
import { DateRangeReport } from "./date-range-report"

type ReportsViewProps = {
    sales: Sale[];
    products: Product[];
    repairJobs: RepairJob[];
    isLoading?: boolean;
}

export function ReportsView({ sales, products, repairJobs, isLoading }: ReportsViewProps) {
    const { format: formatCurrency, getSymbol } = useCurrency();
    const { firestore } = useFirebase();

    const reconciliationsCollection = useMemoFirebase(() => 
        firestore ? collection(firestore, "daily_reconciliations") : null,
        [firestore]
    );
    const { data: reconciliations, isLoading: reconciliationsLoading } = useCollection<DailyReconciliation>(reconciliationsCollection);

    const { todaySales } = useMemo(() => {
        if (!sales) {
            return { todaySales: [] };
        }
        const openSales = sales.filter(s => s.status !== 'refunded' && !s.reconciliationId);
        const todaySales = openSales.filter(s => {
            if (!s.transactionDate) return false;
            try {
                return isToday(new Date(s.transactionDate));
            } catch (e) {
                console.error("Invalid date format for sale:", s.id, s.transactionDate);
                return false;
            }
        });
        return { todaySales };
    }, [sales]);


    return (
        <Tabs defaultValue="summary">
            <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="summary">Resumen y Cierre</TabsTrigger>
                <TabsTrigger value="history">Historial de Cierres</TabsTrigger>
                <TabsTrigger value="repair-analysis">Análisis de Reparaciones</TabsTrigger>
                <TabsTrigger value="log">Registro de Transacciones</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="space-y-4 mt-4">
                 <CashReconciliationDialog openSales={todaySales} />
                 
                 <DateRangeReport 
                    sales={sales} 
                    products={products} 
                    reconciliations={reconciliations || []}
                    isLoading={isLoading || reconciliationsLoading}
                 />
                 
                 <Card>
                    <CardHeader>
                        <CardTitle>Exportar Ventas</CardTitle>
                        <CardDescription>Exporta un registro de ventas en formato Excel para un rango de fechas seleccionado.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ExportSalesButton sales={sales} products={products} />
                    </CardContent>
                 </Card>
            </TabsContent>
            <TabsContent value="history">
                 <ReconciliationHistory reconciliations={reconciliations || []} isLoading={reconciliationsLoading} />
            </TabsContent>
            <TabsContent value="repair-analysis">
                <RepairAnalysis repairJobs={repairJobs || []} products={products || []} isLoading={isLoading} />
            </TabsContent>
            <TabsContent value="log">
                <Card>
                    <CardHeader>
                        <CardTitle>Todas las Transacciones</CardTitle>
                        <CardDescription>Un registro completo de todas las ventas, incluyendo las cerradas y reembolsadas.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TransactionList sales={sales} isLoading={isLoading} />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    )
}
