
"use client";

import type { Sale, Payment, CartItem } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Separator } from "../ui/separator";
import { renderToString } from 'react-dom/server';

type ReceiptViewProps = {
    sale: Sale;
    currencySymbol: string;
    formatCurrency: (value: number) => string;
    getPaymentAmountInCorrectCurrency: (payment: Payment) => string;
}

export function ReceiptView({ sale, currencySymbol, formatCurrency, getPaymentAmountInCorrectCurrency }: ReceiptViewProps) {
    return (
         <div className="text-black bg-white p-2 font-mono text-xs max-w-[215px] mx-auto">
            <div className="text-center mb-2">
                <h3 className="font-semibold text-sm">Nota de Entrega</h3>
                <p>TabletSP+ v1.0.2</p>
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
                            <span>{item.quantity} x {currencySymbol}{formatCurrency(item.price)}</span>
                            <span>{currencySymbol}{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                    </div>
                ))}
            </div>
            <Separator className="my-1 border-dashed border-black" />
            <div className="space-y-1 text-right">
                 <div className="flex justify-between">
                    <p>Sub-total:</p>
                    <p>{currencySymbol}{formatCurrency(sale.subtotal)}</p>
                </div>
                 {sale.discount > 0 && (
                    <div className="flex justify-between">
                        <p>Descuento:</p>
                        <p className="text-destructive">-{currencySymbol}{formatCurrency(sale.discount)}</p>
                    </div>
                )}
                 <div className="flex justify-between font-bold text-sm">
                    <p>Total:</p>
                    <p>{currencySymbol}{formatCurrency(sale.totalAmount)}</p>
                </div>
            </div>
             {sale.payments && sale.payments.length > 0 && (
                 <>
                <Separator className="my-1 border-dashed border-black" />
                <div className="space-y-1">
                    <p className="font-semibold mb-1 text-center">Pagos:</p>
                    {sale.payments.map((p, index) => (
                        <div key={index} className="flex justify-between">
                            <span>{p.method}:</span>
                            <span>{getPaymentAmountInCorrectCurrency(p)}</span>
                        </div>
                    ))}
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
                        .font-semibold { font-weight: 600; } .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
                        .my-1 { margin-top: 0.25rem; margin-bottom: 0.25rem; } .border-dashed { border-style: dashed; }
                        .border-black { border-color: #000; } .flex { display: flex; } .flex-1 { flex: 1 1 0%; }
                        .w-1\\/4 { width: 25%; } .text-right { text-align: right; }
                        .space-y-1 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.25rem; }
                        .break-words { overflow-wrap: break-word; } .justify-between { justify-content: space-between; }
                        .text-destructive { color: hsl(var(--destructive)); } .font-bold { font-weight: 700; }
                        .mt-2 { margin-top: 0.5rem; } .mb-1 { margin-bottom: 0.25rem; }
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
