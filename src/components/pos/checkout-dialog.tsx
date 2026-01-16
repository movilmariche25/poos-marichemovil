

"use client";

import type { CartItem, Payment, PaymentMethod, Sale, Product } from "@/lib/types";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { useState, type ReactNode, useMemo, useEffect } from "react";
import { CreditCard, Landmark, Smartphone, DollarSign, Printer, Trash2, Banknote } from "lucide-react";
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
  onCheckout: (payments: Payment[], changeGiven: Payment[], totalChangeInUSD: number) => Promise<Sale | null>;
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

const changeMethodOptions: { value: PaymentMethod, label: string, icon: ReactNode, isBs: boolean }[] = [
    { value: 'Efectivo USD', label: 'Vuelto en USD', icon: <DollarSign className="w-5 h-5"/>, isBs: false },
    { value: 'Efectivo Bs', label: 'Vuelto en Bs', icon: <Landmark className="w-5 h_5"/>, isBs: true },
    { value: 'Pago Móvil', label: 'Vuelto por P. Móvil', icon: <Smartphone className="w-5 h-5"/>, isBs: true },
];

type TempPayment = Payment & { id: number };

export function CheckoutDialog({ cart, allProducts, total, children, onCheckout, onClearCart, isRepairSale }: CheckoutDialogProps) {
  const [open, setOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const { toast } = useToast();
  const { format: formatCurrency, getSymbol, convert, isLoading: currencyLoading } = useCurrency();
  const [payments, setPayments] = useState<TempPayment[]>([]);
  const [changePayments, setChangePayments] = useState<TempPayment[]>([]);
  const router = useRouter();
  
  useEffect(() => {
    if (open && !completedSale) {
      setPayments([]);
      setChangePayments([]);
    }
  }, [open, completedSale]);

  const totalPaid = useMemo(() => {
    if (currencyLoading) return 0;
    return payments.reduce((acc, payment) => {
      if (payment.method === 'Efectivo USD') {
        return acc + payment.amount;
      }
      // All other methods (Efectivo Bs, Tarjeta, Pago Móvil, Transferencia) are in Bs and need conversion
      return acc + convert(payment.amount, 'Bs', 'USD');
    }, 0);
  }, [payments, convert, currencyLoading]);

  const totalChangeInUSD = useMemo(() => (totalPaid > total ? totalPaid - total : 0), [totalPaid, total]);

  const totalGivenInUSD = useMemo(() => {
      if (currencyLoading) return 0;
      return changePayments.reduce((acc, payment) => {
          if (payment.method === 'Efectivo USD') {
              return acc + payment.amount;
          }
          return acc + convert(payment.amount, 'Bs', 'USD');
      }, 0);
  }, [changePayments, convert, currencyLoading]);

  const changeDifference = useMemo(() => totalChangeInUSD - totalGivenInUSD, [totalChangeInUSD, totalGivenInUSD]);
  
  const canConfirm = totalPaid >= total && total > 0 && Math.abs(changeDifference) < 0.01;


  const handleAddPayment = (method: PaymentMethod) => {
    setPayments(prev => [...prev, { id: Date.now(), method, amount: 0, reference: '' }]);
  };
  const handleUpdatePayment = (id: number, field: 'amount' | 'reference', value: string | number) => {
    setPayments(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };
  const handleRemovePayment = (id: number) => {
    setPayments(prev => prev.filter(p => p.id !== id));
  };
  
  const handleAddChangePayment = (method: PaymentMethod) => {
    setChangePayments(prev => [...prev, { id: Date.now(), method, amount: 0, reference: '' }]);
  };
  const handleUpdateChangePayment = (id: number, field: 'amount' | 'reference', value: string | number) => {
    setChangePayments(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };
  const handleRemoveChangePayment = (id: number) => {
    setChangePayments(prev => prev.filter(p => p.id !== id));
  };


  const handleConfirm = async () => {
    if (!canConfirm) return;
    
    const sale = await onCheckout(
        payments.map(({ id, ...rest }) => rest),
        changePayments.map(({ id, ...rest }) => rest),
        totalChangeInUSD
    );
    
    if(sale) {
        setCompletedSale(sale);
        toast({
            title: "¡Venta Completada!",
            description: `Total: ${getSymbol()}${formatCurrency(sale.totalAmount)}`
        });
    }
  }

  const handleCloseAndReset = () => {
      if (isRepairSale) {
        router.push('/dashboard/repairs');
      } else {
        onClearCart();
      }
      setCompletedSale(null);
      setOpen(false);
  }

  const onPrint = () => {
    if (!completedSale) return;
    const receiptProps = {
      sale: completedSale,
      currency: { format: formatCurrency, getSymbol, convert }
    };
    handlePrintReceipt(receiptProps, (error) => {
      toast({
        variant: "destructive",
        title: "Error de Impresión",
        description: error
      });
    });
  };

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
                    currency={{ format: formatCurrency, getSymbol, convert }}
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
                    <p className="text-4xl font-bold">{getSymbol('USD')}{formatCurrency(total, 'USD')}</p>
                    <p className="text-sm text-muted-foreground">o ~Bs {formatCurrency(convert(total, 'USD', 'Bs'), 'Bs')}</p>
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
                    <ScrollArea className="h-[150px] p-1">
                        <div className="space-y-3">
                            {payments.map(p => {
                                const option = paymentMethodOptions.find(o => o.value === p.method)!;
                                const symbol = option.isBs ? getSymbol('Bs') : getSymbol('USD');
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
                                                placeholder="0,00"
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
                    <div className={cn("font-bold", totalPaid < total ? 'text-destructive' : 'text-green-600')}>
                        <p className="text-2xl">{getSymbol('USD')}{formatCurrency(Math.max(0, total - totalPaid), 'USD')}</p>
                        <p className="text-xs text-secondary-foreground/80">
                            o Bs {formatCurrency(convert(Math.max(0, total - totalPaid), 'USD', 'Bs'), 'Bs')}
                        </p>
                    </div>
                 </div>

                 {totalChangeInUSD > 0.001 && (
                    <div className="space-y-4 pt-4 border-t">
                        <div className="text-center p-2 rounded-lg bg-primary/10">
                            <p className="text-sm text-primary">Vuelto Total Requerido</p>
                            <p className="text-2xl font-bold text-primary">{getSymbol('USD')}{formatCurrency(totalChangeInUSD, 'USD')}</p>
                            <p className="text-sm text-primary/80">o Bs {formatCurrency(convert(totalChangeInUSD, 'USD', 'Bs'), 'Bs')}</p>
                        </div>

                        <div className="space-y-2">
                          <p className="font-medium">Añadir Vuelto</p>
                          <div className="flex flex-wrap gap-2">
                              {changeMethodOptions.map(method => (
                                <Button key={method.value} variant="outline" size="sm" onClick={() => handleAddChangePayment(method.value)}>
                                      {method.icon} {method.label}
                                </Button>
                              ))}
                          </div>
                        </div>

                         {changePayments.length > 0 && (
                            <ScrollArea className="h-[150px] p-1">
                                <div className="space-y-3">
                                    {changePayments.map(p => {
                                        const option = changeMethodOptions.find(o => o.value === p.method)!;
                                        const symbol = option.isBs ? getSymbol('Bs') : getSymbol('USD');
                                        return (
                                        <div key={p.id} className="p-3 border rounded-lg bg-background flex flex-col gap-2">
                                            <div className="flex justify-between items-center">
                                                <Label className="flex items-center gap-2">{option.icon} {option.label}</Label>
                                                <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => handleRemoveChangePayment(p.id)}>
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
                                                        onChange={(e) => handleUpdateChangePayment(p.id, 'amount', parseFloat(e.target.value) || 0)}
                                                        placeholder="0,00"
                                                        className="pl-7"
                                                    />
                                                </div>
                                                {p.method === 'Pago Móvil' && (
                                                  <Input
                                                      type="text"
                                                      value={p.reference || ''}
                                                      onChange={(e) => handleUpdateChangePayment(p.id, 'reference', e.target.value)}
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
                        
                        <div className={cn("text-center font-semibold p-2 rounded-md", Math.abs(changeDifference) > 0.01 ? "bg-destructive/20 text-destructive" : "bg-green-600/20 text-green-700")}>
                            {Math.abs(changeDifference) > 0.01 
                              ? `Falta por devolver: ${getSymbol()}${formatCurrency(Math.abs(changeDifference))} o Bs ${formatCurrency(convert(Math.abs(changeDifference), 'USD', 'Bs'), 'Bs')}` 
                              : "Vuelto Correcto"}
                        </div>
                    </div>
                 )}

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
