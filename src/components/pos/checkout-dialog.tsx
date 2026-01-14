

"use client";

import type { CartItem, Payment, PaymentMethod, Sale, Product } from "@/lib/types";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { useState, type ReactNode, useMemo, useEffect, useCallback } from "react";
import { CreditCard, Landmark, Smartphone, DollarSign, Printer, Trash2, Banknote, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ReceiptView, handlePrintReceipt } from "./receipt-view";
import { useCurrency } from "@/hooks/use-currency";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

type CheckoutDialogProps = {
  cart: CartItem[];
  allProducts: Product[];
  total: number;
  children: ReactNode;
  onCheckout: (payments: Payment[]) => Promise<Sale | null>;
  onClearCart: () => void;
  isRepairSale?: boolean;
};

const paymentMethodOptions: { value: PaymentMethod, label: string, icon: ReactNode, hasReference: boolean, isBs: boolean }[] = [
    { value: 'Efectivo USD', label: 'Efectivo USD', icon: <DollarSign className="w-5 h-5"/>, hasReference: false, isBs: false },
    { value: 'Efectivo Bs', label: 'Efectivo Bs', icon: <Landmark className="w-5 h_5"/>, hasReference: false, isBs: true },
    { value: 'Tarjeta', label: 'Tarjeta', icon: <CreditCard className="w-5 h-5"/>, hasReference: true, isBs: true },
    { value: 'Pago Móvil', label: 'Pago Móvil', icon: <Smartphone className="w-5 h-5"/>, hasReference: true, isBs: true },
    { value: 'Transferencia', label: 'Transferencia', icon: <Banknote className="w-5 h-5"/>, hasReference: true, isBs: true },
];

type TempPayment = Payment & { id: number };

export function CheckoutDialog({ cart, allProducts, total, children, onCheckout, onClearCart, isRepairSale }: CheckoutDialogProps) {
  const [open, setOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const { toast } = useToast();
  const { format, getSymbol, convert, isLoading: currencyLoading } = useCurrency();
  const [payments, setPayments] = useState<TempPayment[]>([]);
  const router = useRouter();


  useEffect(() => {
    if (open && !completedSale) {
      setPayments([]);
    }
  }, [open, completedSale]);

  const totalPaid = useMemo(() => {
    if (currencyLoading) return 0;
    return payments.reduce((acc, payment) => {
      if (payment.method === 'Efectivo USD') {
        return acc + payment.amount;
      }
      return acc + convert(payment.amount, 'Bs', 'USD');
    }, 0);
  }, [payments, convert, currencyLoading]);

  const remaining = total - totalPaid;
  const canConfirm = totalPaid >= total && total > 0;

  const handleAddPayment = (method: PaymentMethod) => {
    setPayments(prev => [...prev, { id: Date.now(), method, amount: 0, reference: '' }]);
  };

  const handleUpdatePayment = (id: number, field: 'amount' | 'reference', value: string | number) => {
    setPayments(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };
  
  const handleRemovePayment = (id: number) => {
    setPayments(prev => prev.filter(p => p.id !== id));
  };


  const handleConfirm = async () => {
    if (!canConfirm) return;

    let activePayments: Payment[] = payments
      .filter(p => p.amount > 0)
      .map(({ id, ...rest }) => rest);
    
    const changeInUSD = totalPaid - total;
    if (changeInUSD > 0.001) { // Use a small epsilon for float comparison
        const usdCashPayment = activePayments.find(p => p.method === 'Efectivo USD');

        if (usdCashPayment) {
            const usdCashPaymentInUSD = usdCashPayment.amount;
            if (usdCashPaymentInUSD >= changeInUSD) {
                usdCashPayment.amount -= changeInUSD;
            } else {
                console.warn("Change exceeds USD cash payment. Complex change calculation not fully implemented.");
                usdCashPayment.amount = 0;
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

  const handleCloseAndReset = () => {
      // Logic after closing the receipt dialog
      if (isRepairSale) {
        router.push('/dashboard/repairs');
      } else {
        onClearCart(); // For regular sales, just clear the cart
      }
      // Reset state for the next transaction
      setCompletedSale(null);
      setOpen(false);
  }

  const getPaymentAmountInCorrectCurrency = useCallback((payment: Payment) => {
    const isUSD = payment.method === 'Efectivo USD';
    const symbol = isUSD ? '$' : 'Bs';
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

  const remainingInUSD = remaining;
  const remainingInBs = convert(remaining, 'USD', 'Bs');
  const changeInUSD = Math.abs(remaining);
  const changeInBs = convert(Math.abs(remaining), 'USD', 'Bs');

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) {
             handleCloseAndReset();
        } else {
            setOpen(true);
        }
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
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
                  <Button onClick={handleCloseAndReset} className="w-full">Cerrar</Button>
              </div>
          </div>
        ) : (
            <>
            <DialogHeader>
                <DialogTitle>Completar Venta</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Monto Total a Pagar</p>
                    <p className="text-4xl font-bold">${format(total)}</p>
                    <p className="text-sm text-muted-foreground">o ~Bs {format(convert(total, 'USD', 'Bs'), 'Bs')}</p>
                </div>
                 <div className="space-y-2">
                    <p className="font-medium">Añadir Pagos</p>
                    <div className="flex flex-wrap gap-2">
                        {paymentMethodOptions.map(method => (
                           <Button key={method.value} variant="outline" size="sm" onClick={() => handleAddPayment(method.value)}>
                                {method.icon} {method.label}
                           </Button>
                        ))}
                    </div>
                </div>

                {payments.length > 0 && (
                    <ScrollArea className="h-[200px] p-1">
                        <div className="space-y-3">
                            {payments.map(p => {
                                const option = paymentMethodOptions.find(o => o.value === p.method)!;
                                const symbol = option.isBs ? 'Bs' : '$';
                                return (
                                <div key={p.id} className="p-3 border rounded-lg bg-background flex flex-col gap-2">
                                     <div className="flex justify-between items-center">
                                        <Label className="flex items-center gap-2">{option.icon} {option.label}</Label>
                                        <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => handleRemovePayment(p.id)}>
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                                <span className="text-gray-500 sm:text-sm">{symbol}</span>
                                            </div>
                                            <Input
                                                type="number"
                                                value={p.amount || ''}
                                                onChange={(e) => handleUpdatePayment(p.id, 'amount', parseFloat(e.target.value) || 0)}
                                                placeholder="0.00"
                                                className="pl-7"
                                            />
                                        </div>
                                         {option.hasReference && (
                                            <Input
                                                type="text"
                                                value={p.reference || ''}
                                                onChange={(e) => handleUpdatePayment(p.id, 'reference', e.target.value)}
                                                placeholder="Referencia (opcional)"
                                                className="flex-1"
                                            />
                                        )}
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                )}
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
