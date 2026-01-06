

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

    const {
        todaySales,
        totalSalesToday,
        profitToday,
        weekSales,
        totalSalesWeek,
        profitWeek
    } = useMemo(() => {
        if (!sales || !products) {
            return {
                todaySales: [],
                totalSalesToday: 0,
                profitToday: 0,
                weekSales: [],
                totalSalesWeek: 0,
                profitWeek: 0
            };
        }

        const calculateProfit = (saleList: Sale[]) => {
            return saleList.reduce((totalProfit, sale) => {
                const costOfGoods = sale.items.reduce((cost, item) => {
                    if (item.isRepair) return cost;
                    const product = products.find(p => p.id === item.productId);
                    return cost + (product ? product.costPrice * item.quantity : 0);
                }, 0);
                return totalProfit + (sale.totalAmount - costOfGoods);
            }, 0);
        };

        const openSales = sales.filter(s => s.status !== 'refunded' && !s.reconciliationId);
        
        const todaySales = openSales.filter(s => {
            if (!s.transactionDate) return false;
            try {
                // To be a "today sale" for reconciliation, it must be open AND created today.
                return isToday(new Date(s.transactionDate));
            } catch (e) {
                console.error("Invalid date format for sale:", s.id, s.transactionDate);
                return false;
            }
        });
        
        const totalSalesToday = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
        const profitToday = calculateProfit(todaySales);

        const weekSales = openSales.filter(s => {
            if(!s.transactionDate) return false;
            try {
                return isThisWeek(new Date(s.transactionDate), { weekStartsOn: 1 })
            } catch (e) {
                return false;
            }
        });
        const totalSalesWeek = weekSales.reduce((sum, s) => sum + s.totalAmount, 0);
        const profitWeek = calculateProfit(weekSales);

        return {
            todaySales,
            totalSalesToday,
            profitToday,
            weekSales,
            totalSalesWeek,
            profitWeek
        };
    }, [sales, products]);

    
    const currentSymbol = getSymbol();

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
                 <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Ventas de Hoy (Abiertas)</CardTitle>
                            <CardDescription>{todaySales.length} transacciones sin cerrar</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {isLoading ? <Skeleton className="h-8 w-32 mb-2" /> : <p className="text-2xl font-bold">{currentSymbol}{formatCurrency(totalSalesToday)}</p>}
                            {isLoading ? <Skeleton className="h-5 w-24" /> : <p className="text-sm text-muted-foreground">Ganancia: <span className="text-green-600">{currentSymbol}{formatCurrency(profitToday)}</span></p>}
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle>Ventas de la Semana (Abiertas)</CardTitle>
                            <CardDescription>{weekSales.length} transacciones sin cerrar</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {isLoading ? <Skeleton className="h-8 w-32 mb-2" /> : <p className="text-2xl font-bold">{currentSymbol}{formatCurrency(totalSalesWeek)}</p>}
                            {isLoading ? <Skeleton className="h-5 w-24" /> : <p className="text-sm text-muted-foreground">Ganancia: <span className="text-green-600">{currentSymbol}{formatCurrency(profitWeek)}</span></p>}
                        </CardContent>
                    </Card>
                 </div>
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
