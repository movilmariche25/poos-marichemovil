

"use client";

import { useState, useMemo } from "react";
import type { Sale, PaymentMethod, DailyReconciliation, ReconciliationPaymentMethodSummary } from "@/lib/types";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { useCurrency } from "@/hooks/use-currency";
import { useFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { collection, doc, writeBatch } from "firebase/firestore";
import { format as formatDate, parseISO } from "date-fns";
import { DoorClosed, Loader2, Printer } from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { cn } from "@/lib/utils";
import { ReconciliationTicket, handlePrintReconciliation } from "./reconciliation-ticket";

type CashReconciliationDialogProps = {
  openSales: Sale[];
};

const paymentMethodsOrder: PaymentMethod[] = ['Efectivo USD', 'Efectivo Bs', 'Tarjeta', 'Pago Móvil', 'Transferencia'];

export function CashReconciliationDialog({ openSales }: CashReconciliationDialogProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const currency = useCurrency();
  const { format: formatCurrency, getSymbol, convert } = currency;
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [completedReconciliation, setCompletedReconciliation] = useState<DailyReconciliation | null>(null);
  const [countedAmounts, setCountedAmounts] = useState<Record<PaymentMethod, number>>({
    'Efectivo USD': 0,
    'Efectivo Bs': 0,
    'Tarjeta': 0,
    'Pago Móvil': 0,
    'Transferencia': 0,
  });

  const {
    expectedAmounts,
    totalPaymentsInUSD,
    totalChangeGivenInUSD,
    netExpectedInUSD
  } = useMemo(() => {
    const totals: Record<PaymentMethod, number> = {
      'Efectivo USD': 0,
      'Efectivo Bs': 0,
      'Tarjeta': 0,
      'Pago Móvil': 0,
      'Transferencia': 0,
    };
    let paymentsUSD = 0;
    let changeUSD = 0;
    
    openSales.forEach(sale => {
      sale.payments.forEach(payment => {
        if (totals[payment.method] !== undefined) {
          totals[payment.method] += payment.amount;
        }
        paymentsUSD += payment.method === 'Efectivo USD' ? payment.amount : convert(payment.amount, 'Bs', 'USD');
      });
      if (sale.changeGiven) {
          sale.changeGiven.forEach(change => {
              if (totals[change.method] !== undefined) {
                  totals[change.method] -= change.amount;
              }
              changeUSD += change.method === 'Efectivo USD' ? change.amount : convert(change.amount, 'Bs', 'USD');
          });
      }
    });

    return { 
      expectedAmounts: totals,
      totalPaymentsInUSD: paymentsUSD,
      totalChangeGivenInUSD: changeUSD,
      netExpectedInUSD: paymentsUSD - changeUSD
    };
  }, [openSales, convert]);


  const differences = useMemo(() => {
    return paymentMethodsOrder.reduce((acc, method) => {
        acc[method] = countedAmounts[method] - expectedAmounts[method];
        return acc;
    }, {} as Record<PaymentMethod, number>);
  }, [countedAmounts, expectedAmounts]);

  const totalSalesValue = openSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  
  const totalCountedInUSD = useMemo(() => {
     return Object.entries(countedAmounts).reduce((acc, [method, amount]) => {
        const typedMethod = method as PaymentMethod;
        if (typedMethod === 'Efectivo USD') {
            return acc + amount;
        }
        return acc + convert(amount, 'Bs', 'USD');
     }, 0)
  }, [countedAmounts, convert]);

  const totalDifference = totalCountedInUSD - netExpectedInUSD;
  const transactionCount = openSales.length;

  const handleAmountChange = (method: PaymentMethod, value: string) => {
    setCountedAmounts(prev => ({ ...prev, [method]: parseFloat(value) || 0 }));
  };

  const handleFinishAndReset = () => {
    setIsOpen(false);
    setCompletedReconciliation(null);
    setCountedAmounts({
      'Efectivo USD': 0,
      'Efectivo Bs': 0,
      'Tarjeta': 0,
      'Pago Móvil': 0,
      'Transferencia': 0,
    });
  };
  
  const onPrint = () => {
    if (!completedReconciliation) return;
    handlePrintReconciliation({ reconciliation: completedReconciliation, currency }, (error) => {
      toast({
        variant: "destructive",
        title: "Error de Impresión",
        description: error,
      });
    });
  };

  const handleCloseDay = async () => {
    if (!firestore || transactionCount === 0) return;
    setIsClosing(true);

    const todayStr = formatDate(new Date(), 'yyyy-MM-dd');
    const reconciliationId = `RECON-${todayStr}`;
    
    if (Object.values(countedAmounts).some(amount => amount < 0)) {
        toast({
            variant: "destructive",
            title: "Monto Inválido",
            description: "Los montos contados no pueden ser negativos.",
        });
        setIsClosing(false);
        return;
    }

    const batch = writeBatch(firestore);
    const reconciliationRef = doc(firestore, 'daily_reconciliations', reconciliationId);
    
    const paymentMethodDetails = paymentMethodsOrder.reduce((acc, method) => {
        if (expectedAmounts[method] > 0 || countedAmounts[method] > 0) {
            acc[method] = {
                expected: expectedAmounts[method],
                counted: countedAmounts[method],
                difference: differences[method],
            };
        }
        return acc;
    }, {} as { [key in PaymentMethod]?: ReconciliationPaymentMethodSummary });

    const newReconciliation: DailyReconciliation = {
      id: reconciliationId,
      date: todayStr,
      totalSales: totalSalesValue,
      totalTransactions: transactionCount,
      closedAt: new Date().toISOString(),
      paymentMethods: paymentMethodDetails,
      totalExpected: netExpectedInUSD,
      totalCounted: totalCountedInUSD,
      totalDifference: totalDifference,
      totalPaymentsReceived: totalPaymentsInUSD,
      totalChangeGiven: totalChangeGivenInUSD,
    };
    batch.set(reconciliationRef, newReconciliation);

    openSales.forEach(sale => {
      const saleRef = doc(firestore, 'sale_transactions', sale.id!);
      batch.update(saleRef, { reconciliationId: reconciliationId });
    });

    try {
      await batch.commit();
      toast({
        title: "Día Cerrado Exitosamente",
        description: `Se han cerrado ${transactionCount} ventas.`,
      });
      setCompletedReconciliation(newReconciliation);
    } catch (error) {
      console.error("Error closing day:", error);
      toast({
        variant: "destructive",
        title: "Error al Cerrar el Día",
        description: "No se pudieron cerrar las ventas. Por favor, inténtalo de nuevo.",
      });
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => {
        if (!val) {
            handleFinishAndReset();
        } else {
            setIsOpen(true);
        }
    }}>
      <Card>
        <CardHeader>
          <CardTitle>Cierre de Ventas del Día</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
           <div className="p-3 rounded-lg bg-muted space-y-2">
                 <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Ventas abiertas hoy</p>
                    <p className="text-lg font-bold">{transactionCount}</p>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <p className="text-muted-foreground">Pagos Recibidos</p>
                    <p className="font-medium text-green-600">+{getSymbol()}{formatCurrency(totalPaymentsInUSD)}</p>
                </div>
                 <div className="flex items-center justify-between text-sm">
                    <p className="text-muted-foreground">Vueltos Entregados</p>
                    <p className="font-medium text-destructive">-{getSymbol()}{formatCurrency(totalChangeGivenInUSD)}</p>
                </div>
                 <div className="flex items-center justify-between font-bold text-base border-t pt-2 mt-2">
                    <p>Neto Esperado en Caja</p>
                    <p>{getSymbol()}{formatCurrency(netExpectedInUSD)}</p>
                </div>
            </div>
          <DialogTrigger asChild>
            <Button className="w-full mt-2" disabled={transactionCount === 0}>
              <DoorClosed className="mr-2 h-4 w-4" />
              Realizar Cierre de Caja
            </Button>
          </DialogTrigger>
        </CardContent>
      </Card>
      <DialogContent className="max-w-3xl">
        {completedReconciliation ? (
            <>
                <DialogHeader>
                    <DialogTitle>Cierre Completado</DialogTitle>
                    <DialogDescription>
                        El cierre de caja para el {formatDate(parseISO(completedReconciliation.closedAt), "PPP")} ha sido guardado.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <ReconciliationTicket reconciliation={completedReconciliation} currency={currency} />
                </div>
                <DialogFooter>
                    <Button onClick={onPrint} variant="outline">
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir
                    </Button>
                    <Button onClick={handleFinishAndReset}>Finalizar</Button>
                </DialogFooter>
            </>
        ) : (
            <>
                <DialogHeader>
                <DialogTitle>Cuadre de Caja - {formatDate(new Date(), "PPP")}</DialogTitle>
                <DialogDescription>
                    Introduce los montos contados para cada método de pago para finalizar el día.
                </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg">Montos Contados</h3>
                        {paymentMethodsOrder.map(method => (
                            <div key={method}>
                                <Label htmlFor={`counted-${method}`} className="text-base">{method}</Label>
                                <div className="relative mt-1">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <span className="text-gray-500 sm:text-sm">{getSymbol(method === 'Efectivo USD' ? 'USD' : 'Bs')}</span>
                                    </div>
                                    <Input
                                        id={`counted-${method}`}
                                        type="number"
                                        value={countedAmounts[method] || ''}
                                        onChange={(e) => handleAmountChange(method, e.target.value)}
                                        placeholder="0.00"
                                        className="pl-7 text-lg h-12"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                        <h3 className="font-semibold text-lg">Resumen del Cuadre</h3>
                        {paymentMethodsOrder.map(method => {
                            if (expectedAmounts[method] === 0 && countedAmounts[method] === 0) return null;
                            const symbol = getSymbol(method === 'Efectivo USD' ? 'USD' : 'Bs');
                            const difference = differences[method];
                            return (
                                <div key={method} className="p-3 bg-background rounded-md">
                                    <p className="font-medium">{method}</p>
                                    <div className="flex justify-between text-sm">
                                        <span>Esperado:</span>
                                        <span>{symbol}{formatCurrency(expectedAmounts[method])}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Contado:</span>
                                        <span>{symbol}{formatCurrency(countedAmounts[method])}</span>
                                    </div>
                                    <div className={cn("flex justify-between text-sm font-semibold", difference < 0 ? 'text-destructive' : 'text-green-600')}>
                                        <span>Diferencia:</span>
                                        <span>{difference >= 0 ? '+' : ''}{symbol}{formatCurrency(difference)}</span>
                                    </div>
                                </div>
                            );
                        })}
                        <div className="border-t pt-4 mt-4">
                            <div className="flex justify-between font-bold text-lg">
                                <span>Diferencia Total (en USD):</span>
                                <span className={cn(totalDifference < 0 ? 'text-destructive' : 'text-green-600')}>
                                    {totalDifference >= 0 ? '+' : ''}{getSymbol()}{formatCurrency(totalDifference)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button onClick={handleCloseDay} disabled={isClosing}>
                    {isClosing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isClosing ? 'Cerrando...' : 'Finalizar y Cerrar Día'}
                </Button>
                </DialogFooter>
            </>
        )}
      </DialogContent>
    </Dialog>
  );
}
