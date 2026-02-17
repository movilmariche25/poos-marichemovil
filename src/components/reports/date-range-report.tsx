
"use client";

import { useState, useMemo } from "react";
import type { Sale, Product, DailyReconciliation } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { DateRange } from "react-day-picker";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "../ui/button";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import { Skeleton } from "../ui/skeleton";

type DateRangeReportProps = {
    sales: Sale[];
    products: Product[];
    reconciliations: DailyReconciliation[];
    isLoading?: boolean;
};

export function DateRangeReport({ sales, products, reconciliations, isLoading }: DateRangeReportProps) {
    const { format: formatCurrency, getSymbol } = useCurrency();
    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfDay(new Date()),
        to: endOfDay(new Date()),
    });

    const {
        totalSales,
        totalProfit,
        totalReconciliationDifference,
        adjustedTotalSales,
        transactionCount,
    } = useMemo(() => {
        if (!date?.from) {
            return { totalSales: 0, totalProfit: 0, totalReconciliationDifference: 0, adjustedTotalSales: 0, transactionCount: 0 };
        }

        const from = startOfDay(date.from);
        const to = date.to ? endOfDay(date.to) : endOfDay(date.from);

        const filteredSales = sales.filter(s => {
            if (s.status !== 'completed' || !s.transactionDate) return false;
            const saleDate = new Date(s.transactionDate);
            return isWithinInterval(saleDate, { start: from, end: to });
        });
        
        const filteredReconciliations = reconciliations.filter(r => {
             const reconDate = new Date(r.date);
             const fromUTC = startOfDay(date.from!);
             const toUTC = endOfDay(date.to || date.from!);
             return reconDate >= fromUTC && reconDate <= toUTC;
        });

        const totalSales = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);

        const totalProfit = filteredSales.reduce((totalProfit, sale) => {
            const costOfGoods = sale.items.reduce((cost, item) => {
                if (item.isRepair) return cost;
                if (item.isCustom) {
                    return cost + ((item.customCostPrice || 0) * item.quantity);
                }
                const product = products.find(p => p.id === item.productId);
                return cost + (product ? product.costPrice * item.quantity : 0);
            }, 0);
            return totalProfit + (sale.totalAmount - costOfGoods);
        }, 0);

        const totalReconciliationDifference = filteredReconciliations.reduce((sum, r) => sum + r.totalDifference, 0);

        return {
            totalSales,
            totalProfit,
            totalReconciliationDifference,
            adjustedTotalSales: totalSales + totalReconciliationDifference,
            transactionCount: filteredSales.length,
        };

    }, [date, sales, products, reconciliations]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Reporte Financiero por Rango</CardTitle>
                <CardDescription>
                    Selecciona un rango de fechas para ver el resumen financiero de ventas completadas y cierres de caja.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={"outline"}
                            className={cn(
                            "w-full sm:w-[300px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date?.from ? (
                            date.to ? (
                                <>
                                {format(date.from, "LLL dd, y", { locale: es })} -{" "}
                                {format(date.to, "LLL dd, y", { locale: es })}
                                </>
                            ) : (
                                format(date.from, "LLL dd, y", { locale: es })
                            )
                            ) : (
                            <span>Selecciona una fecha</span>
                            )}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={date?.from}
                            selected={date}
                            onSelect={setDate}
                            numberOfMonths={2}
                            locale={es}
                        />
                        </PopoverContent>
                    </Popover>
                    <p className="text-sm text-muted-foreground">{transactionCount} transacciones en el período.</p>
                </div>
                
                {isLoading ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                         <div className="p-4 rounded-lg bg-muted">
                            <p className="text-sm font-medium text-muted-foreground">Total de Ventas</p>
                            <p className="text-2xl font-bold">{getSymbol()}{formatCurrency(totalSales)}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted">
                            <p className="text-sm font-medium text-muted-foreground">Ganancia Estimada</p>
                            <p className={cn("text-2xl font-bold", totalProfit > 0 ? "text-green-600" : "text-destructive")}>
                                {getSymbol()}{formatCurrency(totalProfit)}
                            </p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted">
                            <p className="text-sm font-medium text-muted-foreground">Diferencia de Cierres</p>
                            <p className={cn("text-2xl font-bold", totalReconciliationDifference >= 0 ? "text-green-600" : "text-destructive")}>
                                {totalReconciliationDifference >= 0 ? '+' : ''}{getSymbol()}{formatCurrency(totalReconciliationDifference)}
                            </p>
                        </div>
                        <div className="p-4 rounded-lg bg-primary text-primary-foreground">
                            <p className="text-sm font-medium text-primary-foreground/80">Ingreso Real Estimado</p>
                             <p className="text-2xl font-bold">{getSymbol()}{formatCurrency(adjustedTotalSales)}</p>
                        </div>
                    </div>
                )}


            </CardContent>
        </Card>
    );
}
