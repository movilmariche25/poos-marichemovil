
import type { RepairJob } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { renderToString } from "react-dom/server";

type RepairTicketProps = {
    repairJob: RepairJob;
}

// SECCIÓN 1: NOTA DE ENTREGA (CLIENTE)
export function CustomerTicket({ repairJob }: RepairTicketProps) {
    const total = repairJob.estimatedCost || 0;
    const abono = repairJob.amountPaid || 0;
    const saldo = Math.max(0, total - abono);
    const date = repairJob.createdAt ? parseISO(repairJob.createdAt) : new Date();
    const fecha = format(date, "dd/MM/yy hh:mm a", { locale: es });

    return (
        <div className="text-black bg-white font-mono text-[10px] max-w-[215px] mx-auto">
            <div className="text-center mb-2">
                <h3 className="font-bold text-sm uppercase">MARICHE MOVIL</h3>
                <p className="text-[9px] font-bold">NOTA DE ENTREGA (CLIENTE)</p>
            </div>
            
            <div className="flex justify-between text-[9px] font-bold mb-2">
                <span>{fecha}</span>
                <span>ID: {repairJob.id}</span>
            </div>

            <div className="space-y-0.5">
                <p><span className="font-bold">Cliente:</span> {repairJob.customerName}</p>
                <p><span className="font-bold">CI:</span> {repairJob.customerID || 'N/A'} | <span className="font-bold">Tlf:</span> {repairJob.customerPhone}</p>
                <p><span className="font-bold">Equipo:</span> {repairJob.deviceMake} {repairJob.deviceModel}</p>
                {repairJob.deviceImei && <p><span className="font-bold">IMEI:</span> {repairJob.deviceImei}</p>}
                <p><span className="font-bold">Falla:</span> {repairJob.reportedIssue}</p>
            </div>

            <div className="border-t border-black mt-2 pt-1 space-y-1">
                <div className="flex justify-between">
                    <span>Costo Total:</span>
                    <span>${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Abono:</span>
                    <span>${abono.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-xs border-t border-black pt-1">
                    <span>SALDO PENDIENTE:</span>
                    <span>${saldo.toFixed(2)}</span>
                </div>
            </div>

            <div className="border-t border-black mt-2 pt-1 text-[8px] leading-tight space-y-1 italic">
                <p><span className="font-bold">Garantía:</span> 4 días por el servicio específico realizado.</p>
                <p><span className="font-bold">PLAZO DE RETIRO:</span> 7 días continuos una vez notificado. Pasado este lapso, MARICHE MOVIL no se hace responsable por la integridad, resguardo o pérdida del mismo.</p>
                <p>Indispensable presentar este ticket para el retiro del equipo.</p>
            </div>
            <div className="text-center mt-4">
                <p>¡Gracias por su confianza!</p>
            </div>
        </div>
    );
}

// SECCIÓN 2: CONTROL INTERNO (NEGOCIO)
export function InternalTicket({ repairJob }: RepairTicketProps) {
    const total = repairJob.estimatedCost || 0;
    const abono = repairJob.amountPaid || 0;
    const saldo = Math.max(0, total - abono);
    const date = repairJob.createdAt ? parseISO(repairJob.createdAt) : new Date();
    const fecha = format(date, "dd/MM/yy", { locale: es });
    const hora = format(date, "hh:mm a", { locale: es });

    const checklistItems = [
        ['Encendido', 'Cámaras'],
        ['Carga/PIN', 'Audio/Mic'],
        ['Touch/LCD', 'Botones'],
        ['Señal/WiFi', 'Biometría']
    ];

    return (
        <div className="text-black bg-white font-mono text-[10px] max-w-[215px] mx-auto">
            <div className="text-center mb-2">
                <h3 className="font-bold text-[11px] uppercase">CONTROL INTERNO: MARICHE MOVIL</h3>
                <p className="text-[9px]">ID: {repairJob.id} | Fecha: {fecha} | Hora: {hora}</p>
            </div>

            <div className="border-t border-black pt-1 mb-2">
                <p className="font-bold">📱 DATOS DEL SERVICIO</p>
                <p><span className="font-bold">Cliente:</span> {repairJob.customerName} ({repairJob.customerID || 'N/A'})</p>
                <p><span className="font-bold">Equipo:</span> {repairJob.deviceMake} {repairJob.deviceModel}</p>
                <p><span className="font-bold">Falla:</span> {repairJob.reportedIssue}</p>
                <p><span className="font-bold">Costo:</span> ${total.toFixed(2)} | <span className="font-bold">Abono:</span> ${abono.toFixed(2)} | <span className="font-bold">Saldo:</span> ${saldo.toFixed(2)}</p>
            </div>

            <div className="border-t border-black pt-1 mb-2">
                <p className="font-bold mb-1">✅ CHECKLIST (ENTRADA vs SALIDA)</p>
                <table className="w-full border-collapse text-[9px]">
                    <thead>
                        <tr className="border-b border-black">
                            <th className="text-left py-0.5">Función</th>
                            <th className="text-center py-0.5">E</th>
                            <th className="text-center py-0.5">S</th>
                            <th className="text-left py-0.5 pl-2 border-l border-black">Función</th>
                            <th className="text-center py-0.5">E</th>
                            <th className="text-center py-0.5">S</th>
                        </tr>
                    </thead>
                    <tbody>
                        {checklistItems.map(([f1, f2], idx) => (
                            <tr key={idx} className="border-b border-gray-200">
                                <td className="py-1">{f1}</td>
                                <td className="text-center text-[8px] font-mono">[ ]</td>
                                <td className="text-center text-[8px] font-mono">[ ]</td>
                                <td className="py-1 pl-2 border-l border-black">{f2}</td>
                                <td className="text-center text-[8px] font-mono">[ ]</td>
                                <td className="text-center text-[8px] font-mono">[ ]</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className="text-[7px] text-center mt-1 italic uppercase">E: Entrada (Al recibir) | S: Salida (Al entregar)</p>
            </div>

            {repairJob.devicePatternOrPassword && (
                <div className="mb-2 p-1.5 bg-gray-100 border border-black rounded text-center">
                    <p className="font-bold text-[9px] uppercase">Clave/Patrón:</p>
                    <p className="text-sm font-bold">{repairJob.devicePatternOrPassword}</p>
                </div>
            )}

            <div className="mb-3 space-y-1">
                <p>Obs. Técnicas: ________________________________</p>
                <p>________________________________________________</p>
                <p>________________________________________________</p>
                <p>________________________________________________</p>
            </div>

            <div className="border-t border-black pt-1 mb-3">
                <p className="font-bold uppercase text-[8px]">✍️ 1. FIRMA DE RECEPCIÓN (AL DEJAR)</p>
                <p className="text-[7.5px] leading-tight italic">"Declaro que el equipo es de mi propiedad y acepto el estado inicial registrado en la columna (E). Entiendo que tengo 7 días continuos para retirar el equipo tras la notificación, de lo contrario MARICHE MOVIL no se hace responsable."</p>
                <div className="mt-4 border-b border-black w-3/4 mx-auto"></div>
                <p className="text-center font-bold text-[8px] mt-1">Firma Cliente</p>
            </div>

            <div className="border-t border-black pt-1">
                <p className="font-bold uppercase text-[8px]">✍️ 2. FIRMA DE ENTREGA (AL RETIRAR)</p>
                <p className="text-[7.5px] leading-tight italic">"Recibo mi equipo reparado, probado y a total conformidad según la columna (S). Acepto que a partir de hoy inician mis 4 días de garantía bajo los términos del ticket."</p>
                <div className="mt-4 border-b border-black w-3/4 mx-auto"></div>
                <p className="text-center font-bold text-[8px] mt-1">Firma Cliente</p>
            </div>
        </div>
    );
}

// SECCIÓN 3: ETIQUETA DE EQUIPO (PEGATINA)
export function StickerTicket({ repairJob }: RepairTicketProps) {
    const total = repairJob.estimatedCost || 0;
    const abono = repairJob.amountPaid || 0;
    const saldo = Math.max(0, total - abono);

    return (
        <div className="text-black bg-white font-mono text-[10px] max-w-[215px] mx-auto p-1">
            <div className="border border-black p-2 space-y-0.5">
                <p className="font-bold text-[11px]">ID: {repairJob.id}</p>
                <p><span className="font-bold text-[9px]">Cliente:</span> {repairJob.customerName}</p>
                <p><span className="font-bold text-[9px]">Modelo:</span> {repairJob.deviceMake} {repairJob.deviceModel}</p>
                <p className="font-bold text-xs pt-1 border-t border-dotted border-black">SALDO: ${saldo.toFixed(2)}</p>
            </div>
        </div>
    );
}

const printStyles = `
    @media print {
        @page { margin: 0; size: auto; }
        body { margin: 0; padding: 10px; }
    }
    body { 
        margin: 0; 
        padding: 15px; 
        font-family: monospace; 
        background-color: #fff; 
        color: #000;
    }
    .ticket-container { 
        width: 58mm; 
        margin: 0 auto; 
        box-sizing: border-box; 
    }
    .text-center { text-align: center; }
    .font-bold { font-weight: 700; }
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .border-t { border-top: 1px solid #000; }
    .border-b { border-bottom: 1px solid #000; }
    .border-dashed { border-style: dashed !important; }
    .border-dotted { border-style: dotted !important; }
    .border { border: 1px solid #000; }
    .border-gray-200 { border-color: #e5e7eb; }
    .border-gray-400 { border-color: #9ca3af; }
    .bg-gray-100 { background-color: #f3f4f6; }
    .w-full { width: 100%; }
    .w-3\\/4 { width: 75%; }
    .mx-auto { margin-left: auto; margin-right: auto; }
    .space-y-0\\.5 > * + * { margin-top: 0.125rem; }
    .space-y-1 > * + * { margin-top: 0.25rem; }
    .space-y-2 > * + * { margin-top: 0.5rem; }
    .space-y-3 > * + * { margin-top: 0.75rem; }
    .space-y-4 > * + * { margin-top: 1rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-3 { margin-bottom: 0.75rem; }
    .mb-4 { margin-bottom: 1rem; }
    .my-4 { margin-top: 1rem; margin-bottom: 1rem; }
    .mt-1 { margin-top: 0.125rem; }
    .mt-2 { margin-top: 0.25rem; }
    .mt-3 { margin-top: 0.5rem; }
    .mt-4 { margin-top: 1rem; }
    .p-0\\.5 { padding: 0.125rem; }
    .p-1 { padding: 0.25rem; }
    .p-2 { padding: 0.5rem; }
    .pt-1 { padding-top: 0.25rem; }
    .pt-2 { padding-top: 0.5rem; }
    .pt-4 { padding-top: 1rem; }
    .text-xs { font-size: 12px; }
    .text-sm { font-size: 14px; }
    .uppercase { text-transform: uppercase; }
    .italic { font-style: italic; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: none; padding: 2px; }
    .border-l { border-left: 1px solid #000; }
`;

function createPrintWindow(html: string, title: string) {
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (printWindow) {
        printWindow.document.write(`
            <html>
                <head>
                    <title>${title}</title>
                    <style>${printStyles}</style>
                </head>
                <body>
                    <div class="ticket-container">${html}</div>
                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 500);
                        }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    } else {
        throw new Error("No se pudo abrir la ventana de impresión.");
    }
}

export const handlePrintCustomerTicket = (props: RepairTicketProps, onError: (message: string) => void) => {
    try {
        const html = renderToString(<CustomerTicket {...props} />);
        createPrintWindow(html, `Nota Cliente - ${props.repairJob.id}`);
    } catch (e: any) {
        onError(e.message);
    }
};

export const handlePrintInternalTicket = (props: RepairTicketProps, onError: (message: string) => void) => {
    try {
        const html = renderToString(<InternalTicket {...props} />);
        createPrintWindow(html, `Control Interno - ${props.repairJob.id}`);
    } catch (e: any) {
        onError(e.message);
    }
};

export const handlePrintStickerTicket = (props: RepairTicketProps, onError: (message: string) => void) => {
    try {
        const html = renderToString(<StickerTicket {...props} />);
        createPrintWindow(html, `Etiqueta - ${props.repairJob.id}`);
    } catch (e: any) {
        onError(e.message);
    }
};

export const handlePrintAllTickets = (props: RepairTicketProps, onError: (message: string) => void) => {
    try {
        const html = renderToString(
            <>
                <CustomerTicket {...props} />
                <div className="my-4 border-t border-dashed border-black"></div>
                <InternalTicket {...props} />
                <div className="my-4 border-t border-dashed border-black"></div>
                <StickerTicket {...props} />
            </>
        );
        createPrintWindow(html, `Tickets Reparación - ${props.repairJob.id}`);
    } catch (e: any) {
        onError(e.message);
    }
};
