
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, Printer } from "lucide-react";
import type { Sale, Payment, PaymentMethod } from "@/lib/types";
import { useCurrency } from "@/hooks/use-currency";
import { Separator } from "../ui/separator";
import { renderToString } from 'react-dom/server';
import { format as formatDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";

type CashReconciliationDialogProps = {
  todaySales: Sale[];
};

type ReconciliationData = {
  expected: number;
  counted: number;
  difference: number;
};

const paymentMethodsOrder: PaymentMethod[] = ['Efectivo USD', 'Efectivo Bs', 'Tarjeta', 'Pago Móvil'];

const getPaymentMethodSymbol = (method: PaymentMethod) => {
    if (method === 'Efectivo USD') return '$';
    if (method === 'Efectivo Bs' || method === 'Tarjeta' || method === 'Pago Móvil') return 'Bs';
    return '';
}

const ReconciliationReport = ({ reconciliation, date, formatCurrency, totalDifferenceInUSD }: { reconciliation: Record<string, ReconciliationData>, date: Date, formatCurrency: (value: number) => string, totalDifferenceInUSD: number }) => {

    return (
        <div className="font-mono text-xs text-black bg-white max-w-[300px] p-2">
            <div className="text-center mb-2">
                <h3 className="font-bold text-sm">Cuadre de Caja</h3>
                <p>{formatDate(date, "PPP p", { locale: es })}</p>
            </div>
            <Separator className="my-1 border-dashed border-black" />
            
            {paymentMethodsOrder.map(method => {
                if(!reconciliation[method] || reconciliation[method].expected === 0 && reconciliation[method].counted === 0) return null;
                const data = reconciliation[method];
                const symbol = getPaymentMethodSymbol(method);
                return (
                     <div key={method} className="text-xs">
                        <p className="font-bold text-center my-1">{method}</p>
                        <div className="flex justify-between"><span>Sistema:</span><span>{symbol}{formatCurrency(data.expected)}</span></div>
                        <div className="flex justify-between"><span>Contado:</span><span>{symbol}{formatCurrency(data.counted)}</span></div>
                        <div className="flex justify-between font-semibold"><span>Diferencia:</span><span>{symbol}{formatCurrency(data.counted - data.expected)}</span></div>
                        <Separator className="my-1 border-dashed border-black" />
                    </div>
                )
            })}
            
            <div className="mt-2 text-sm text-center font-bold">
                <p>DIFERENCIA TOTAL (en USD): ${formatCurrency(totalDifferenceInUSD)}</p>
            </div>

            <div className="mt-6 border-t border-black pt-4">
                <p className="text-center">_________________________</p>
                <p className="text-center font-semibold">Firma del Gerente</p>
            </div>
        </div>
    )
}

export function CashReconciliationDialog({ todaySales }: CashReconciliationDialogProps) {
  const [open, setOpen] = useState(false);
  const { format, convert } = useCurrency();
  const { toast } = useToast();
  
  const [countedAmounts, setCountedAmounts] = useState<Record<PaymentMethod, number>>({
      'Efectivo USD': 0,
      'Efectivo Bs': 0,
      'Tarjeta': 0,
      'Pago Móvil': 0,
  });

  const expectedAmounts = paymentMethodsOrder.reduce((acc, method) => {
      acc[method] = 0;
      return acc;
  }, {} as Record<PaymentMethod, number>);

  todaySales.forEach(sale => {
      if (sale.payments) {
        sale.payments.forEach(payment => {
            if (expectedAmounts[payment.method] !== undefined) {
                expectedAmounts[payment.method] += payment.amount;
            }
        })
      }
  });

  const reconciliation = paymentMethodsOrder.reduce((acc, method) => {
      const expected = expectedAmounts[method] || 0;
      const counted = countedAmounts[method] || 0;
      
      let differenceInUSD: number;
      if (method === 'Efectivo USD') {
          differenceInUSD = counted - expected;
      } else {
          const diffInBs = counted - expected;
          differenceInUSD = convert(diffInBs, 'Bs', 'USD');
      }

      acc[method] = {
          expected: expected,
          counted: counted,
          difference: differenceInUSD
      };
      return acc;
  }, {} as Record<string, ReconciliationData>);
  
  const totalDifference = Object.values(reconciliation).reduce((acc, curr) => acc + curr.difference, 0);

  const handlePrint = () => {
    const reportHtml = renderToString(
        <ReconciliationReport 
            reconciliation={reconciliation} 
            date={new Date()} 
            formatCurrency={format}
            totalDifferenceInUSD={totalDifference}
        />
    );
    const printWindow = window.open('', '_blank', 'width=320,height=600');
    if (printWindow) {
        printWindow.document.write(`
            <html>
                <head>
                    <title>Cuadre de Caja</title>
                     <style>
                        body { margin: 0; font-family: monospace; }
                        .font-mono { font-family: monospace; }
                        .text-xs { font-size: 0.75rem; line-height: 1rem; }
                        .text-black { color: #000; }
                        .bg-white { background-color: #fff; }
                        .max-w-\\[300px\\] { max-width: 300px; }
                        .p-2 { padding: 0.5rem; }
                        .text-center { text-align: center; }
                        .mb-2 { margin-bottom: 0.5rem; }
                        .font-bold { font-weight: 700; }
                        .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
                        .my-1 { margin-top: 0.25rem; margin-bottom: 0.25rem; }
                        .border-dashed { border-style: dashed; }
                        .border-black { border-color: #000; }
                        .flex { display: flex; }
                        .justify-between { justify-content: space-between; }
                        .font-semibold { font-weight: 600; }
                        .mt-2 { margin-top: 0.5rem; }
                        .mt-6 { margin-top: 1.5rem; }
                        .pt-4 { padding-top: 1rem; }
                        .border-t { border-top-width: 1px; }
                    </style>
                </head>
                <body>
                    ${reportHtml}
                    <script>
                        window.onload = function() { window.print(); window.close(); }
                    <\/script>
                </body>
            </html>
        `);
        printWindow.document.close();
    } else {
        toast({
            variant: "destructive",
            title: "Error de Impresión",
            description: "No se pudo abrir la ventana. Revisa el bloqueador de pop-ups."
        })
    }
  };


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
            <Calculator className="mr-2 h-4 w-4" />
            Realizar Cuadre de Caja
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Cuadre de Caja Diario</DialogTitle>
          <DialogDescription>
            Compara los montos registrados por el sistema con el dinero contado físicamente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-8 py-4">
            <div className="space-y-4">
                <h3 className="font-semibold text-base text-center">Montos de la Jornada</h3>
                {paymentMethodsOrder.map(method => {
                    const symbol = getPaymentMethodSymbol(method);
                    const expected = reconciliation[method].expected;
                    return (
                        <div key={method} className="space-y-2">
                             <Label htmlFor={method} className="text-sm">{method}</Label>
                             <div className="flex items-center gap-4 p-2 border rounded-md bg-muted/50">
                                <div className="flex-1">
                                    <p className="text-xs text-muted-foreground">Sistema</p>
                                    <p className="font-semibold text-sm">{symbol}{format(expected)}</p>
                                </div>
                                <div className="flex-1">
                                    <Label htmlFor={method} className="text-xs">Contado</Label>
                                    <div className="relative">
                                         <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <span className="text-gray-500 sm:text-sm">{symbol}</span>
                                        </div>
                                        <Input
                                            id={method}
                                            type="number"
                                            value={countedAmounts[method] || ''}
                                            onChange={(e) => setCountedAmounts(prev => ({ ...prev, [method]: parseFloat(e.target.value) || 0 }))}
                                            placeholder="0.00"
                                            className="pl-7 h-9"
                                        />
                                    </div>
                                </div>
                             </div>
                        </div>
                    )
                })}
            </div>
            
            <div className="space-y-4 p-4 rounded-lg bg-secondary">
                 <h3 className="font-semibold text-base text-center">Resumen de Diferencias</h3>
                 <div className="space-y-2">
                    {paymentMethodsOrder.map(method => {
                         if (reconciliation[method].expected === 0 && reconciliation[method].counted === 0) return null;
                         const diff = reconciliation[method].difference;
                         const symbol = getPaymentMethodSymbol(method);
                         const diffInOriginalCurrency = method === 'Efectivo USD' ? diff : convert(diff, 'USD', 'Bs');
                         const color = diff === 0 ? 'text-gray-500' : diff > 0 ? 'text-green-600' : 'text-destructive';

                         return (
                            <div key={method} className="flex justify-between items-center p-2 rounded-md bg-background">
                                <span className="font-medium text-sm">{method}</span>
                                <span className={`font-bold text-sm ${color}`}>{symbol}{format(diffInOriginalCurrency)}</span>
                            </div>
                         )
                    })}
                 </div>
                 <Separator />
                 <div className="text-center pt-2">
                     <p className="text-sm font-medium">Diferencia Total (en USD)</p>
                     <p className={`text-xl font-bold ${totalDifference === 0 ? '' : totalDifference > 0 ? 'text-green-600' : 'text-destructive'}`}>
                        ${format(totalDifference)}
                    </p>
                 </div>
            </div>
        </div>
        <DialogFooter>
            <Button type="button" variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir
            </Button>
            <Button type="button" onClick={() => setOpen(false)}>
                Cerrar
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
