

'use client';

import type { DailyReconciliation, PaymentMethod } from "@/lib/types";
import { format as formatDate, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { renderToString } from "react-dom/server";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";

type ReconciliationTicketProps = {
    reconciliation: DailyReconciliation;
    currency: ReturnType<typeof useCurrency>;
}

const paymentMethodsOrder: PaymentMethod[] = ['Efectivo USD', 'Efectivo Bs', 'Tarjeta', 'Pago Móvil', 'Transferencia'];

export function ReconciliationTicket({ reconciliation, currency }: ReconciliationTicketProps) {
    const { format, getSymbol } = currency;
    
    return (
        <div className="text-black bg-white p-2 font-mono text-xs max-w-[215px] mx-auto">
            <div className="text-center mb-2">
                <h3 className="font-bold text-sm">Cierre de Caja</h3>
                <p>MARICHE MOVIL</p>
                <p>Fecha: {formatDate(parseISO(reconciliation.closedAt), "dd/MM/yy hh:mm a", { locale: es })}</p>
                <p className="font-bold text-sm">ID: {reconciliation.id}</p>
            </div>

            <div className="my-2 border-t border-dashed border-black"></div>

            <div className="space-y-1">
                <div className="flex justify-between">
                    <span className="font-semibold">Ventas Totales:</span>
                    <span>{getSymbol('USD')}{format(reconciliation.totalSales, 'USD')}</span>
                </div>
                 <div className="flex justify-between">
                    <span className="font-semibold">Transacciones:</span>
                    <span>{reconciliation.totalTransactions}</span>
                </div>
            </div>
            
            <div className="my-2 border-t border-dashed border-black"></div>

            <div className="space-y-2">
                {paymentMethodsOrder.map(method => {
                    if (!reconciliation.paymentMethods || !reconciliation.paymentMethods[method]) return null;
                    const details = reconciliation.paymentMethods[method]!;
                    const symbol = getSymbol(method === 'Efectivo USD' ? 'USD' : 'Bs');
                    return (
                        <div key={method}>
                            <p className="font-semibold text-center">{method}</p>
                            <div className="flex justify-between"><span>Esperado:</span><span>{symbol}{format(details.expected)}</span></div>
                            <div className="flex justify-between"><span>Contado:</span><span>{symbol}{format(details.counted)}</span></div>
                            <div className={cn("flex justify-between font-bold", details.difference < 0 ? 'text-destructive' : 'text-green-600')}>
                                <span>Diferencia:</span><span>{details.difference >= 0 ? '+' : ''}{symbol}{format(details.difference)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

             <div className="my-2 border-t border-dashed border-black"></div>

             <div className="flex justify-between font-bold text-sm">
                <p>Dif. Total (USD):</p>
                 <p className={cn(reconciliation.totalDifference < 0 ? 'text-destructive' : 'text-green-600')}>
                    {reconciliation.totalDifference >= 0 ? '+' : ''}{getSymbol('USD')}{format(reconciliation.totalDifference, 'USD')}
                </p>
             </div>
        </div>
    );
}

export const handlePrintReconciliation = (props: ReconciliationTicketProps, onError: (message: string) => void) => {
    const ticketHtml = renderToString(<ReconciliationTicket {...props} />);
    const printWindow = window.open('', '_blank', 'width=300,height=500');

    if (printWindow) {
        printWindow.document.write(`
            <html>
                <head>
                    <title>Reporte de Cierre de Caja</title>
                    <style>
                        body { margin: 0; font-family: monospace; font-size: 10px; }
                        .ticket-container { width: 58mm; padding: 2mm; box-sizing: border-box; }
                        .text-black { color: #000; } .bg-white { background-color: #fff; } .p-2 { padding: 0.5rem; }
                        .font-mono { font-family: monospace; } .text-xs { font-size: 0.75rem; line-height: 1rem; }
                        .max-w-\\[215px\\] { max-width: 215px; } .mx-auto { margin-left: auto; margin-right: auto; }
                        .text-center { text-align: center; } .mb-2 { margin-bottom: 0.5rem; } .my-2 { margin-top: 0.5rem; margin-bottom: 0.5rem; }
                        .font-bold { font-weight: 700; } .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
                        .border-dashed { border-style: dashed; } .border-t { border-top-width: 1px; }
                        .border-black { border-color: #000; } .flex { display: flex; }
                        .space-y-1 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.25rem; }
                        .space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.5rem; }
                        .justify-between { justify-content: space-between; }
                        .font-semibold { font-weight: 600; }
                        .text-destructive { color: hsl(0, 84.2%, 60.2%); }
                        .text-green-600 { color: #16a34a; }
                    </style>
                </head>
                <body>
                    <div class="ticket-container">${ticketHtml.replace(/className="/g, 'class="')}</div>
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
}

    