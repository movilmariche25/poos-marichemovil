

"use client";

import type { CartItem, Payment, PaymentMethod, Sale, Product } from "@/lib/types";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { useState, type ReactNode, useMemo, useEffect, useCallback } from "react";
import { CreditCard, Landmark, Smartphone, DollarSign, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ReceiptView, handlePrintReceipt } from "./receipt-view";
import { useCurrency } from "@/hooks/use-currency";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type CheckoutDialogProps = {
  cart: CartItem[];
  allProducts: Product[];
  total: number;
  children: ReactNode;
  onCheckout: (payments: Payment[]) => Promise<Sale | null>;
  onClearCart: () => void;
};

const paymentMethods: { value: PaymentMethod, label: string, icon: ReactNode }[] = [
    { value: 'Efectivo USD', label: 'Efectivo USD', icon: <DollarSign className="w-5 h-5"/> },
    { value: 'Efectivo Bs', label: 'Efectivo Bs', icon: <Landmark className="w-5 h_5"/> },
    { value: 'Tarjeta', label: 'Tarjeta', icon: <CreditCard className="w-5 h-5"/> },
    { value: 'Pago Móvil', label: 'Pago Móvil', icon: <Smartphone className="w-5 h-5"/> },
]

export function CheckoutDialog({ cart, allProducts, total, children, onCheckout, onClearCart }: CheckoutDialogProps) {
  const [open, setOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const { toast } = useToast();
  const { format, getSymbol, currency, bsExchangeRate, convert, isLoading: currencyLoading } = useCurrency();
  
  const [payments, setPayments] = useState<Record<PaymentMethod, number>>({
    'Efectivo USD': 0,
    'Efectivo Bs': 0,
    'Tarjeta': 0,
    'Pago Móvil': 0,
  });

  useEffect(() => {
    if (open) {
      setPayments({
        'Efectivo USD': 0,
        'Efectivo Bs': 0,
        'Tarjeta': 0,
        'Pago Móvil': 0,
      });
      setCompletedSale(null);
    }
  }, [open, total]);

  const totalPaid = useMemo(() => {
    if (currencyLoading) return 0;
    // The reference currency for calculation is always USD, as the `total` is in USD.
    const totalPaidInUSD = Object.entries(payments).reduce((acc, [method, amount]) => {
        const paymentMethod = method as PaymentMethod;
        if (amount === 0) return acc;

        if (paymentMethod === 'Efectivo USD') {
            return acc + amount;
        } else {
            // Convert Bs payments to USD for summation
            return acc + convert(amount, 'Bs', 'USD');
        }
    }, 0);
    
    return totalPaidInUSD;
  }, [payments, convert, currencyLoading]);


  const remaining = total - totalPaid;
  const canConfirm = totalPaid >= total && total > 0;

  const handlePaymentChange = (method: PaymentMethod, value: string) => {
    const amount = parseFloat(value) || 0;
    setPayments(prev => ({ ...prev, [method]: amount }));
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;

    let activePayments: Payment[] = Object.entries(payments)
      .filter(([, amount]) => amount > 0)
      .map(([method, amount]) => ({
        method: method as PaymentMethod,
        amount: amount
      }));
    
    const changeInUSD = totalPaid - total;
    if (changeInUSD > 0.001) { // Use a small epsilon for float comparison
        const usdCashPayment = activePayments.find(p => p.method === 'Efectivo USD');

        if (usdCashPayment) {
            // Deduct the change from the USD cash payment if possible
            if (usdCashPayment.amount >= changeInUSD) {
                usdCashPayment.amount -= changeInUSD;
            } else {
                // This case is complex and implies change is given from multiple currencies.
                // For simplicity, we assume change is primarily given from USD cash.
                // Or you might want to show a warning that change cannot be calculated precisely.
                console.warn("Change exceeds USD cash payment. Complex change calculation not fully implemented.");
                usdCashPayment.amount = 0; // Deduct what we can
            }
        }
    }

    const finalPayments = activePayments.filter(p => p.amount > 0.001);
    const sale = await onCheckout(finalPayments);
    if(sale) {
        setCompletedSale(sale);
        toast({
            title: "¡Venta Completada!",
            description: `Total: ${getSymbol()}${format(sale.totalAmount)}`
        });
    }
  }

  const handleClose = () => {
      if (completedSale) {
        onClearCart();
      }
      setOpen(false);
  }

  const getPaymentAmountInCorrectCurrency = useCallback((payment: Payment) => {
    const symbol = payment.method === 'Efectivo USD' ? '$' : 'Bs';
    return `${symbol}${format(payment.amount)}`;
  }, [format]);

  const onPrint = () => {
    if (!completedSale) return;
    const receiptProps = {
      sale: completedSale,
      currencySymbol: getSymbol(),
      formatCurrency: format,
      getPaymentAmountInCorrectCurrency: getPaymentAmountInCorrectCurrency
    };
    handlePrintReceipt(receiptProps, (error) => {
      toast({
        variant: "destructive",
        title: "Error de Impresión",
        description: error
      });
    });
  };


  const getPaymentMethodSymbol = (method: PaymentMethod) => {
      if (method === 'Efectivo USD') return '$';
      if (method === 'Efectivo Bs' || method === 'Tarjeta' || method === 'Pago Móvil') return 'Bs';
      return getSymbol();
  }

  const remainingInUSD = remaining;
  const remainingInBs = convert(remaining, 'USD', 'Bs');
  const changeInUSD = Math.abs(remaining);
  const changeInBs = convert(Math.abs(remaining), 'USD', 'Bs');

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
        else setOpen(true);
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {completedSale ? (
            <div className="flex flex-col h-full">
               <div className="p-4">
                  <DialogTitle>Venta Completada</DialogTitle>
                </div>
              <div className="overflow-y-auto p-4">
                <ReceiptView 
                    sale={completedSale} 
                    currencySymbol={getSymbol()}
                    formatCurrency={format}
                    getPaymentAmountInCorrectCurrency={getPaymentAmountInCorrectCurrency}
                />
              </div>
              <div className="mt-auto p-6 bg-background flex gap-2">
                   <Button onClick={onPrint} variant="outline" className="w-full">
                      <Printer className="mr-2 h-4 w-4" />
                      Imprimir Recibo
                  </Button>
                  <Button onClick={handleClose} className="w-full">Cerrar</Button>
              </div>
          </div>
        ) : (
            <>
            <DialogHeader>
                <DialogTitle>Completar Venta</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-6">
                <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Monto Total a Pagar</p>
                    <p className="text-4xl font-bold">${format(total)}</p>
                    <p className="text-sm text-muted-foreground">o ~Bs {format(convert(total, 'USD', 'Bs'), 'Bs')}</p>
                </div>

                <div className="space-y-2">
                    <p className="font-medium">Introducir Pagos</p>
                     <div className="grid grid-cols-2 gap-4">
                        {paymentMethods.map(method => (
                           <div key={method.value}>
                                <Label htmlFor={method.value} className="flex items-center gap-2 mb-1 text-sm">{method.icon} {method.label}</Label>
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <span className="text-gray-500 sm:text-sm">{getPaymentMethodSymbol(method.value)}</span>
                                    </div>
                                    <Input 
                                        id={method.value}
                                        type="number"
                                        value={payments[method.value] || ''}
                                        onChange={(e) => handlePaymentChange(method.value, e.target.value)}
                                        placeholder="0.00"
                                        className="pl-7"
                                    />
                                </div>
                           </div>
                        ))}
                    </div>
                </div>
                 <div className="text-center p-3 rounded-lg bg-secondary text-secondary-foreground">
                    <p className="text-sm">Monto Restante</p>
                    <div className={`font-bold ${remaining > 0.001 ? 'text-destructive' : 'text-green-600'}`}>
                        <p className="text-2xl">${format(remainingInUSD < 0 ? 0 : remainingInUSD, 'USD')}</p>
                        <p className="text-lg">o Bs {format(remainingInBs < 0 ? 0 : remainingInBs, 'Bs')}</p>
                    </div>
                    {remaining < -0.001 && (
                         <div className="text-xs mt-1">
                            <p>Vuelto: ${format(changeInUSD, 'USD')} o Bs {format(changeInBs, 'Bs')}</p>
                        </div>
                    )}
                </div>

            </div>
            <Button size="lg" onClick={handleConfirm} disabled={!canConfirm || currencyLoading}>
                {currencyLoading ? 'Cargando tasa...' : 'Confirmar Pago'}
            </Button>
            </>
        )}
      </DialogContent>
    </Dialog>
  );
}

    