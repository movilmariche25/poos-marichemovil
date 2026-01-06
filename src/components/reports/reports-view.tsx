"use client"

import type { Product, Sale } from "@/lib/types"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { TransactionList } from "./transaction-list"
import { isToday, isThisWeek } from "date-fns"
import { useCurrency } from "@/hooks/use-currency"
import { Skeleton } from "../ui/skeleton"
import { CashReconciliationDialog } from "./cash-reconciliation-dialog"
import { ExportSalesButton } from "./export-sales-button"

type ReportsViewProps = {
    sales: Sale[];
    products: Product[];
    isLoading?: boolean;
}

export function ReportsView({ sales, products, isLoading }: ReportsViewProps) {
    const { format, getSymbol } = useCurrency();
    
    // Filter out refunded sales from calculations
    const validSales = sales.filter(s => s.status !== 'refunded');

    const todaySales = validSales.filter(s => isToday(new Date(s.transactionDate)));
    const weekSales = validSales.filter(s => isThisWeek(new Date(s.transactionDate), { weekStartsOn: 1 }));

    const calculateProfit = (saleList: Sale[]) => {
        return saleList.reduce((totalProfit, sale) => {
            const costOfGoods = sale.items.reduce((cost, item) => {
                if (item.isRepair) return cost;
                const product = products.find(p => p.id === item.productId);
                return cost + (product ? product.costPrice * item.quantity : 0);
            }, 0);
            return totalProfit + (sale.subtotal - (sale.discount || 0) - costOfGoods);
        }, 0);
    }
    
    const totalSalesToday = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
    const profitToday = calculateProfit(todaySales);
    
    const totalSalesWeek = weekSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const profitWeek = calculateProfit(weekSales);
    
    const currentSymbol = getSymbol();

    return (
        <Tabs defaultValue="summary">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="summary">Resumen de Ventas</TabsTrigger>
                <TabsTrigger value="log">Registro de Transacciones</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="space-y-4">
                 <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Ventas de Hoy</CardTitle>
                            <CardDescription>{todaySales.length} transacciones</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {isLoading ? <Skeleton className="h-8 w-32 mb-2" /> : <p className="text-2xl font-bold">{currentSymbol}{format(totalSalesToday)}</p>}
                            {isLoading ? <Skeleton className="h-5 w-24" /> : <p className="text-sm text-muted-foreground">Ganancia: <span className="text-green-600">{currentSymbol}{format(profitToday)}</span></p>}
                        </CardContent>
                        <CardFooter>
                            <CashReconciliationDialog todaySales={todaySales} />
                        </CardFooter>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle>Ventas de la Semana</CardTitle>
                            <CardDescription>{weekSales.length} transacciones</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {isLoading ? <Skeleton className="h-8 w-32 mb-2" /> : <p className="text-2xl font-bold">{currentSymbol}{format(totalSalesWeek)}</p>}
                            {isLoading ? <Skeleton className="h-5 w-24" /> : <p className="text-sm text-muted-foreground">Ganancia: <span className="text-green-600">{currentSymbol}{format(profitWeek)}</span></p>}
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
            <TabsContent value="log">
                <Card>
                    <CardHeader>
                        <CardTitle>Todas las Transacciones</CardTitle>
                        <CardDescription>Un registro completo de todas las ventas.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TransactionList sales={sales} isLoading={isLoading} />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    )
}
