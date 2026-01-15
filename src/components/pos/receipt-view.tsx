

"use client";

import type { Sale, Payment, CartItem } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Separator } from "../ui/separator";
import { renderToString } from 'react-dom/server';
import { useCurrency } from "@/hooks/use-currency";

type ReceiptViewProps = {
    sale: Sale;
    currency: Pick<ReturnType<typeof useCurrency>, 'format' | 'getSymbol' | 'convert'>;
}

export function ReceiptView({ sale, currency }: ReceiptViewProps) {
    const { format: formatCurrency, getSymbol } = currency;

    const getPaymentAmountInCorrectCurrency = (payment: Payment) => {
        const isUSD = payment.method === 'Efectivo USD';
        const symbol = isUSD ? getSymbol('USD') : getSymbol('Bs');
        return `${symbol}${formatCurrency(payment.amount, isUSD ? 'USD' : 'Bs')}`;
    };

    return (
         <div className="text-black bg-white p-2 font-mono text-xs max-w-[215px] mx-auto">
            <div className="text-center mb-2">
                <h3 className="font-semibold text-sm">Nota de Entrega</h3>
                <p>MARICHE MOVIL</p>
                <p>{format(parseISO(sale.transactionDate), "dd/MM/yy hh:mm a", { locale: es })}</p>
                <p>ID: {sale.id}</p>
            </div>
            <Separator className="my-1 border-dashed border-black" />
            <div className="flex font-semibold">
                <div className="flex-1">Producto</div>
                <div className="w-1/4 text-right">Total</div>
            </div>
            <Separator className="my-1 border-dashed border-black" />
            <div className="space-y-1">
                {sale.items.map(item => (
                    <div key={item.productId}>
                        <div className="break-words">{item.name}</div>
                        <div className="flex justify-between">
                            <span>{item.quantity} x {getSymbol('USD')}{formatCurrency(item.price, 'USD')}</span>
                            <span>{getSymbol('USD')}{formatCurrency(item.price * item.quantity, 'USD')}</span>
                        </div>
                    </div>
                ))}
            </div>
            <Separator className="my-1 border-dashed border-black" />
            <div className="space-y-1 text-right">
                 <div className="flex justify-between">
                    <p>Sub-total:</p>
                    <p>{getSymbol('USD')}{formatCurrency(sale.subtotal, 'USD')}</p>
                </div>
                 {sale.discount > 0 && (
                    <div className="flex justify-between">
                        <p>Descuento:</p>
                        <p className="text-destructive">-{getSymbol('USD')}{formatCurrency(sale.discount, 'USD')}</p>
                    </div>
                )}
                 <div className="flex justify-between font-bold text-sm">
                    <p>Total:</p>
                    <p>{getSymbol('USD')}{formatCurrency(sale.totalAmount, 'USD')}</p>
                </div>
            </div>
            
            <Separator className="my-1 border-dashed border-black" />
            <div className="space-y-1">
                <p className="font-semibold mb-1 text-center">Pagos:</p>
                {sale.payments.map((p, index) => (
                    <div key={index} className="flex justify-between">
                        <span>{p.method}{p.reference ? ` (${p.reference})` : ''}:</span>
                        <span>{getPaymentAmountInCorrectCurrency(p)}</span>
                    </div>
                ))}
            </div>

            {sale.changeGiven && sale.changeGiven.length > 0 && (
                 <>
                <Separator className="my-1 border-dashed border-black" />
                <div className="space-y-1">
                    <p className="font-semibold mb-1 text-center">Vuelto:</p>
                    {sale.changeGiven.map((change, index) => {
                        const isUSD = change.method === 'Efectivo USD';
                        const symbol = isUSD ? getSymbol('USD') : getSymbol('Bs');
                        return (
                            <div key={index} className="flex justify-between font-bold">
                                <p>{change.method}:</p>
                                <p>{symbol}{formatCurrency(change.amount, isUSD ? 'USD' : 'Bs')}</p>
                            </div>
                        );
                    })}
                </div>
                </>
            )}

             <Separator className="my-1 border-dashed border-black" />
             <div className="text-center mt-2">
                <p>¡Gracias por su compra!</p>
             </div>
        </div>
    )
};

export const handlePrintReceipt = (props: ReceiptViewProps, onError: (message: string) => void) => {
    const receiptHtml = renderToString(<ReceiptView {...props} />);
    const printWindow = window.open('', '_blank', 'width=300,height=500');

    if (printWindow) {
        printWindow.document.write(`
            <html>
                <head>
                    <title>Recibo</title>
                    <style>
                        body { margin: 0; font-family: monospace; font-size: 10px; }
                        .receipt-container { width: 58mm; padding: 2mm; box-sizing: border-box; }
                         .text-black { color: #000; } .bg-white { background-color: #fff; } .p-2 { padding: 0.5rem; }
                        .font-mono { font-family: monospace; } .text-xs { font-size: 0.75rem; line-height: 1rem; }
                        .max-w-\\[215px\\] { max-width: 215px; } .mx-auto { margin-left: auto; margin-right: auto; }
                        .text-center { text-align: center; } .mb-2 { margin-bottom: 0.5rem; }
                        .my-1 { margin-top: 0.25rem; margin-bottom: 0.25rem; } .border-dashed { border-style: dashed; }
                        .border-black { border-color: #000; } .flex { display: flex; } .flex-1 { flex: 1 1 0%; }
                        .w-1\\/4 { width: 25%; } .text-right { text-align: right; }
                        .space-y-1 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.25rem; }
                        .break-words { overflow-wrap: break-word; } .justify-between { justify-content: space-between; }
                        .text-destructive { color: hsl(var(--destructive)); } .font-bold { font-weight: 700; }
                        .mt-2 { margin-top: 0.5rem; } .mb-1 { margin-bottom: 0.25rem; } .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
                    </style>
                </head>
                <body>
                    <div class="receipt-container">${receiptHtml}</div>
                    <script>
                        window.onload = function() { window.print(); }
                    <\/script>
                </body>
            </html>
        `);
        printWindow.document.close();
    } else {
        onError("No se pudo abrir la ventana de impresión. Revisa si tu navegador está bloqueando las ventanas emergentes.");
    }
};
