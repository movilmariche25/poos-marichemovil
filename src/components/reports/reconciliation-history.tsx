
"use client";

import type { DailyReconciliation, PaymentMethod } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useCurrency } from "@/hooks/use-currency";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

type ReconciliationHistoryProps = {
  reconciliations: DailyReconciliation[];
  isLoading?: boolean;
};

const paymentMethodsOrder: PaymentMethod[] = ['Efectivo USD', 'Efectivo Bs', 'Tarjeta', 'Pago Móvil'];

const DifferenceIndicator = ({ difference }: { difference: number }) => {
    if (Math.abs(difference) < 0.01) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (difference > 0) return <ArrowUp className="h-4 w-4 text-green-600" />;
    return <ArrowDown className="h-4 w-4 text-destructive" />;
};


export function ReconciliationHistory({ reconciliations, isLoading }: ReconciliationHistoryProps) {
  const { format: formatCurrency, getSymbol } = useCurrency();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!reconciliations || reconciliations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historial de Cierres</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No hay cierres de caja registrados todavía.</p>
        </CardContent>
      </Card>
    );
  }
  
  const sortedReconciliations = [...reconciliations].sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());

  return (
     <Card>
        <CardHeader>
          <CardTitle>Historial de Cierres de Caja</CardTitle>
          <CardDescription>Consulta los detalles de cada cierre de día.</CardDescription>
        </CardHeader>
        <CardContent>
            <Accordion type="single" collapsible className="w-full">
                {sortedReconciliations.map(recon => (
                    <AccordionItem value={recon.id} key={recon.id}>
                        <AccordionTrigger>
                             <div className="flex justify-between w-full pr-4">
                                <div className="text-left">
                                    <p className="font-semibold">{format(parseISO(recon.closedAt), "PPP", { locale: es })}</p>
                                    <p className="text-xs text-muted-foreground">ID: {recon.id}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className={cn("flex items-center gap-1 font-semibold", recon.totalDifference < 0 ? 'text-destructive' : 'text-green-600')}>
                                       <DifferenceIndicator difference={recon.totalDifference} />
                                       {getSymbol('USD')}{formatCurrency(recon.totalDifference, 'USD')}
                                    </div>
                                    <p className="font-semibold text-lg">{getSymbol()}{formatCurrency(recon.totalSales)}</p>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                           <div className="p-4 bg-muted/50 rounded-lg">
                                <h4 className="font-semibold mb-2">Detalles del Cierre</h4>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Método de Pago</TableHead>
                                            <TableHead className="text-right">Esperado</TableHead>
                                            <TableHead className="text-right">Contado</TableHead>
                                            <TableHead className="text-right">Diferencia</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paymentMethodsOrder.map(method => {
                                            if (!recon.paymentMethods) return null;
                                            const details = recon.paymentMethods[method];
                                            if (!details) return null;
                                            const symbol = getSymbol(method === 'Efectivo USD' ? 'USD' : 'Bs');
                                            return (
                                                <TableRow key={method}>
                                                    <TableCell className="font-medium">{method}</TableCell>
                                                    <TableCell className="text-right">{symbol}{formatCurrency(details.expected)}</TableCell>
                                                    <TableCell className="text-right">{symbol}{formatCurrency(details.counted)}</TableCell>
                                                    <TableCell className={cn("text-right font-medium", details.difference < 0 ? 'text-destructive' : 'text-green-600')}>
                                                        {details.difference >= 0 ? '+' : ''}{symbol}{formatCurrency(details.difference)}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                        <TableRow className="font-bold bg-background">
                                             <TableCell colSpan={3}>Diferencia Total (en USD)</TableCell>
                                             <TableCell className={cn("text-right", recon.totalDifference < 0 ? 'text-destructive' : 'text-green-600')}>
                                                {recon.totalDifference >= 0 ? '+' : ''}{getSymbol('USD')}{formatCurrency(recon.totalDifference, 'USD')}
                                             </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                           </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </CardContent>
     </Card>
  );
}
