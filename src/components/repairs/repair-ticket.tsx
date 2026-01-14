
import type { RepairJob } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { renderToString } from "react-dom/server";

type RepairTicketProps = {
    repairJob: RepairJob;
    variant: 'client' | 'internal';
}

export function RepairTicket({ repairJob, variant }: RepairTicketProps) {
    
    if (variant === 'internal') {
        return (
             <div className="text-black bg-white p-2 font-mono text-xs max-w-[215px] mx-auto">
                <div className="text-center mb-2">
                    <h3 className="font-bold text-sm">Nota de Entrega (INTERNA)</h3>
                    <p>MARICHE MOVIL</p>
                    <p>Fecha: {repairJob.createdAt ? format(parseISO(repairJob.createdAt), "dd/MM/yy hh:mm a", { locale: es }) : ''}</p>
                    <p className="font-bold text-sm">ID: {repairJob.id}</p>
                </div>
                
                <div className="my-2 border-t border-dashed border-black"></div>

                <div className="space-y-1">
                    <p><span className="font-semibold">Cliente:</span> {repairJob.customerName}</p>
                    {repairJob.customerID && <p><span className="font-semibold">CI:</span> {repairJob.customerID}</p>}
                    <p><span className="font-semibold">Teléfono:</span> {repairJob.customerPhone}</p>
                    {repairJob.customerAddress && <p><span className="font-semibold">Dirección:</span> {repairJob.customerAddress}</p>}
                </div>

                <div className="my-2 border-t border-dashed border-black"></div>

                <div className="space-y-1">
                    <p><span className="font-semibold">Dispositivo:</span> {repairJob.deviceMake} {repairJob.deviceModel}</p>
                    {repairJob.deviceImei && <p><span className="font-semibold">IMEI/Serie:</span> {repairJob.deviceImei}</p>}
                    <div>
                        <p className="font-semibold">Falla Reportada:</p>
                        <p className="break-words">{repairJob.reportedIssue}</p>
                    </div>
                    {(repairJob.initialConditionsChecklist && repairJob.initialConditionsChecklist.length > 0) && (
                        <div className="mt-1">
                            <p className="font-semibold">Condiciones Iniciales:</p>
                            <ul className="list-disc list-inside">
                                {repairJob.initialConditionsChecklist.map((item, index) => <li key={index}>{item}</li>)}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="my-2 border-t border-dashed border-black"></div>

                <div className="text-right space-y-1">
                    <p><span className="font-semibold">Costo Estimado:</span> ${repairJob.estimatedCost.toFixed(2)}</p>
                    {repairJob.amountPaid > 0 && <p><span className="font-semibold">Abono:</span> ${repairJob.amountPaid.toFixed(2)}</p>}
                    <p className="font-bold"><span className="font-semibold">Saldo Pendiente:</span> ${Math.max(0, repairJob.estimatedCost - repairJob.amountPaid).toFixed(2)}</p>
                </div>

                <div className="mt-4 pt-4 border-t border-black">
                    <p className="text-center">_________________________</p>
                    <p className="text-center font-semibold">Firma del Cliente</p>
                </div>

                <div className="mt-4 pt-2 border-t border-dashed border-black text-center">
                    <p className="text-xs">Recorte y pegue en el equipo</p>
                    <p className="font-bold text-lg tracking-wider">{repairJob.id}</p>
                </div>
             </div>
        )
    }

    // Client Ticket
    return (
        <div className="text-black bg-white p-2 font-mono text-xs max-w-[215px] mx-auto">
            <div className="text-center mb-2">
                <h3 className="font-bold text-sm">Nota de Entrega</h3>
                <p>MARICHE MOVIL</p>
                <p>Fecha: {repairJob.createdAt ? format(parseISO(repairJob.createdAt), "dd/MM/yy hh:mm a", { locale: es }) : ''}</p>
                <p className="font-bold text-sm">ID: {repairJob.id}</p>
            </div>
            
            <div className="my-2 border-t border-dashed border-black"></div>

            <div className="space-y-1">
                <p><span className="font-semibold">Cliente:</span> {repairJob.customerName}</p>
                {repairJob.customerID && <p><span className="font-semibold">CI:</span> {repairJob.customerID}</p>}
                <p><span className="font-semibold">Teléfono:</span> {repairJob.customerPhone}</p>
                {repairJob.customerAddress && <p><span className="font-semibold">Dirección:</span> {repairJob.customerAddress}</p>}
            </div>

            <div className="my-2 border-t border-dashed border-black"></div>

            <div className="space-y-1">
                <p><span className="font-semibold">Dispositivo:</span> {repairJob.deviceMake} {repairJob.deviceModel}</p>
                {repairJob.deviceImei && <p><span className="font-semibold">IMEI/Serie:</span> {repairJob.deviceImei}</p>}
                <div>
                    <p className="font-semibold">Falla Reportada:</p>
                    <p className="break-words">{repairJob.reportedIssue}</p>
                </div>
                 {(repairJob.initialConditionsChecklist && repairJob.initialConditionsChecklist.length > 0) && (
                    <div className="mt-1">
                        <p className="font-semibold">Condiciones Iniciales:</p>
                        <ul className="list-disc list-inside">
                            {repairJob.initialConditionsChecklist.map((item, index) => <li key={index}>{item}</li>)}
                        </ul>
                    </div>
                )}
            </div>

            <div className="my-2 border-t border-dashed border-black"></div>

            <div className="text-right space-y-1">
                 <p><span className="font-semibold">Costo Estimado:</span> ${repairJob.estimatedCost.toFixed(2)}</p>
                 {repairJob.amountPaid > 0 && <p><span className="font-semibold">Abono:</span> ${repairJob.amountPaid.toFixed(2)}</p>}
                 <p className="font-bold"><span className="font-semibold">Saldo Pendiente:</span> ${Math.max(0, repairJob.estimatedCost - repairJob.amountPaid).toFixed(2)}</p>
            </div>

             <div className="my-2 border-t border-dashed border-black"></div>

            <div className="text-left mt-2 text-[10px] space-y-1">
                <p className="font-bold text-center">Términos y Condiciones:</p>
                <p>1. La garantía del servicio o reparación es de 4 días a partir de la fecha de entrega.</p>
                <p>2. Problemas No Relacionados: La garantía cubre exclusivamente la pieza o el servicio específico detallado en este ticket. Si el equipo presenta una falla nueva y diferente (ej. se reparó la pantalla y luego falla la batería), esta no está cubierta.</p>
                <p>3. No nos hacemos responsables por equipos abandonados después de 30 días de ser notificado para su retiro.</p>
                <p>4. El cliente declara que el equipo es de su propiedad y no tiene reporte de robo.</p>
                <p>5. Es indispensable presentar este ticket para retirar su equipo.</p>
            </div>
        </div>
    )
}


export const handlePrintTicket = (props: RepairTicketProps, onError: (message: string) => void) => {
    const ticketHtml = renderToString(<RepairTicket {...props} />);
    const printWindow = window.open('', '_blank', 'width=300,height=500');

    if (printWindow) {
        printWindow.document.write(`
            <html>
                <head>
                    <title>Ticket de Reparación</title>
                     <style>
                        body { margin: 0; font-family: monospace; font-size: 10px; }
                        .ticket-container { width: 58mm; padding: 2mm; box-sizing: border-box; }
                        .text-black { color: #000; } .bg-white { background-color: #fff; } .p-2 { padding: 0.5rem; }
                        .font-mono { font-family: monospace; } .text-xs { font-size: 0.75rem; line-height: 1rem; }
                        .max-w-\\[215px\\] { max-width: 215px; } .mx-auto { margin-left: auto; margin-right: auto; }
                        .text-center { text-align: center; } .mb-2 { margin-bottom: 0.5rem; } .my-2 { margin-top: 0.5rem; margin-bottom: 0.5rem; }
                        .font-bold { font-weight: 700; } .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
                        .my-1 { margin-top: 0.25rem; margin-bottom: 0.25rem; } .border-dashed { border-style: dashed; } .border-t { border-top-width: 1px; }
                        .border-black { border-color: #000; } .flex { display: flex; } .flex-1 { flex: 1 1 0%; }
                        .w-1\\/4 { width: 25%; } .text-right { text-align: right; }
                        .space-y-1 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.25rem; }
                        .break-words { overflow-wrap: break-word; } .justify-between { justify-content: space-between; }
                        .text-destructive { color: hsl(var(--destructive)); }
                        .mt-2 { margin-top: 0.5rem; } .mb-1 { margin-bottom: 0.25rem; } .mt-4 { margin-top: 1rem; } .pt-4 { padding-top: 1rem; }
                        .font-semibold { font-weight: 600; } .text-\\[10px\\] { font-size: 10px; }
                        .text-lg { font-size: 1.125rem; line-height: 1.75rem; } .tracking-wider { letter-spacing: 0.05em; }
                        .pt-2 { padding-top: 0.5rem; }
                        .text-left { text-align: left; }
                        .list-disc { list-style-type: disc; } .list-inside { list-style-position: inside; }
                        .mt-1 { margin-top: 0.25rem; }
                    </style>
                </head>
                <body>
                    <div class="ticket-container">${ticketHtml}</div>
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

