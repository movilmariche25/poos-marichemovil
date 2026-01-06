
"use client";

import { useState, useMemo } from "react";
import type { Sale, PaymentMethod, DailyReconciliation, ReconciliationPaymentMethodSummary } from "@/lib/types";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { useCurrency } from "@/hooks/use-currency";
import { useFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { collection, doc, writeBatch } from "firebase/firestore";
import { format as formatDate } from "date-fns";
import { DoorClosed, Loader2 } from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { cn } from "@/lib/utils";

type CashReconciliationDialogProps = {
  openSales: Sale[];
};

const paymentMethodsOrder: PaymentMethod[] = ['Efectivo USD', 'Efectivo Bs', 'Tarjeta', 'Pago Móvil'];

export function CashReconciliationDialog({ openSales }: CashReconciliationDialogProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { format: formatCurrency, getSymbol, convert } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [countedAmounts, setCountedAmounts] = useState<Record<PaymentMethod, number>>({
    'Efectivo USD': 0,
    'Efectivo Bs': 0,
    'Tarjeta': 0,
    'Pago Móvil': 0,
  });

  const expectedAmounts = useMemo(() => {
    const totals: Record<PaymentMethod, number> = {
      'Efectivo USD': 0,
      'Efectivo Bs': 0,
      'Tarjeta': 0,
      'Pago Móvil': 0,
    };
    openSales.forEach(sale => {
      sale.payments.forEach(payment => {
        totals[payment.method] += payment.amount;
      });
    });
    return totals;
  }, [openSales]);

  const differences = useMemo(() => {
    return paymentMethodsOrder.reduce((acc, method) => {
        acc[method] = countedAmounts[method] - expectedAmounts[method];
        return acc;
    }, {} as Record<PaymentMethod, number>);
  }, [countedAmounts, expectedAmounts]);

  const totalExpected = openSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  
  const totalCountedInUSD = useMemo(() => {
     return Object.entries(countedAmounts).reduce((acc, [method, amount]) => {
        const typedMethod = method as PaymentMethod;
        if (typedMethod === 'Efectivo USD') {
            return acc + amount;
        }
        // All other methods (Efectivo Bs, Tarjeta, Pago Móvil) are in Bs and need conversion
        return acc + convert(amount, 'Bs', 'USD');
     }, 0)
  }, [countedAmounts, convert]);

  const totalDifference = totalCountedInUSD - totalExpected;
  const transactionCount = openSales.length;

  const handleAmountChange = (method: PaymentMethod, value: string) => {
    setCountedAmounts(prev => ({ ...prev, [method]: parseFloat(value) || 0 }));
  };

  const handleCloseDay = async () => {
    if (!firestore || transactionCount === 0) return;
    setIsClosing(true);

    const todayStr = formatDate(new Date(), 'yyyy-MM-dd');
    const reconciliationId = `RECON-${todayStr}`;
    
    // Check for negative counted values, which are not allowed
    if (Object.values(countedAmounts).some(amount => amount < 0)) {
        toast({
            variant: "destructive",
            title: "Monto Inválido",
            description: "Los montos contados no pueden ser negativos. Por favor, revisa los valores.",
        });
        setIsClosing(false);
        return;
    }

    const batch = writeBatch(firestore);
    const reconciliationRef = doc(firestore, 'daily_reconciliations', reconciliationId);
    
    const paymentMethodDetails = paymentMethodsOrder.reduce((acc, method) => {
        acc[method] = {
            expected: expectedAmounts[method],
            counted: countedAmounts[method],
            difference: differences[method],
        };
        return acc;
    }, {} as { [key in PaymentMethod]: ReconciliationPaymentMethodSummary });

    const newReconciliation: DailyReconciliation = {
      id: reconciliationId,
      date: todayStr,
      totalSales: totalExpected,
      totalTransactions: transactionCount,
      closedAt: new Date().toISOString(),
      paymentMethods: paymentMethodDetails,
      totalExpected: totalExpected,
      totalCounted: totalCountedInUSD,
      totalDifference: totalDifference,
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
      setIsOpen(false);
      setCountedAmounts({ 'Efectivo USD': 0, 'Efectivo Bs': 0, 'Tarjeta': 0, 'Pago Móvil': 0 });
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader>
          <CardTitle>Cierre de Ventas del Día</CardTitle>
        </CardHeader>
        <CardContent>
           <div className="p-4 rounded-lg bg-muted flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-muted-foreground">Ventas abiertas hoy</p>
                    <p className="text-2xl font-bold">{transactionCount}</p>
                </div>
                <div>
                    <p className="text-sm font-medium text-muted-foreground">Total a cerrar</p>
                    <p className="text-2xl font-bold text-right">{getSymbol()}{formatCurrency(totalExpected)}</p>
                </div>
            </div>
          <DialogTrigger asChild>
            <Button className="w-full mt-4" disabled={transactionCount === 0}>
              <DoorClosed className="mr-2 h-4 w-4" />
              Realizar Cierre de Caja
            </Button>
          </DialogTrigger>
        </CardContent>
      </Card>
      <DialogContent className="max-w-3xl">
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
      </DialogContent>
    </Dialog>
  );
}
