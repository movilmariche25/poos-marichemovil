

"use client"

import type { Sale, Payment, Product, CartItem } from "@/lib/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useCurrency } from "@/hooks/use-currency";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { ReceiptView, handlePrintReceipt } from "../pos/receipt-view";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Printer, Undo2, CheckCircle2 } from "lucide-react";
import React, { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "../ui/skeleton";
import { AdminAuthDialog } from "../admin-auth-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import { useFirebase } from "@/firebase";
import { doc, runTransaction } from "firebase/firestore";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

type TransactionListProps = {
    sales: Sale[];
    isLoading?: boolean;
};

const RefundButton = ({ sale }: { sale: Sale }) => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [refundReason, setRefundReason] = useState("");
    const [stockAction, setStockAction] = useState<'return' | 'damage'>('return');
    
    const handleRefund = async () => {
        if (!firestore || !sale.id || !refundReason.trim()) {
             toast({
                variant: "destructive",
                title: "Error",
                description: "El motivo del reembolso es obligatorio."
            });
            return;
        }
        
        try {
            await runTransaction(firestore, async (transaction) => {
                // 1. Update product stock based on user selection
                for (const item of sale.items) {
                    if (!item.isRepair) {
                        const productRef = doc(firestore, 'products', item.productId);
                        const productDoc = await transaction.get(productRef);
                        if (productDoc.exists()) {
                            const product = productDoc.data() as Product;
                            const currentDamagedStock = product.damagedStock || 0;
                            if (stockAction === 'return') {
                                 // To "return" stock, we decrease the damaged/consumed amount
                                 const newDamagedStock = currentDamagedStock - item.quantity;
                                 transaction.update(productRef, { damagedStock: Math.max(0, newDamagedStock) });
                            } else { // 'damage' - stock was already considered damaged/consumed, so no change needed
                                 // No change to stock counters, as the refund doesn't make the part usable again.
                            }
                        }
                    }
                }

                // 2. Mark sale as refunded with reason
                const saleRef = doc(firestore, 'sale_transactions', sale.id!);
                transaction.update(saleRef, {
                    status: 'refunded',
                    refundedAt: new Date().toISOString(),
                    refundReason: refundReason
                });
            });

            toast({
                title: "Reembolso Completado",
                description: `La venta ${sale.id} ha sido marcada como reembolsada.`
            });

        } catch (error) {
            console.error("Error al procesar el reembolso:", error);
            toast({
                variant: "destructive",
                title: "Error en el Reembolso",
                description: "No se pudo completar el reembolso. Inténtalo de nuevo."
            });
        } finally {
            setIsConfirmOpen(false);
            setRefundReason("");
        }
    };
    
    const onAuthorized = () => {
        setIsConfirmOpen(true);
    };

    if (sale.status === 'refunded') {
        return <Badge variant="secondary">Reembolsado</Badge>;
    }
    
    // Do not allow refund if the sale is part of a closed reconciliation
    if (sale.reconciliationId) {
        return <Badge variant="outline">Cerrada</Badge>
    }
    
    return (
        <>
            <AdminAuthDialog onAuthorized={onAuthorized}>
                <Button variant="outline" size="sm">
                    <Undo2 className="mr-2 h-4 w-4" />
                    Reembolsar
                </Button>
            </AdminAuthDialog>

            <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Confirmar Reembolso?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción marcará la venta como reembolsada y ajustará el inventario.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4 space-y-4">
                        <div>
                            <Label htmlFor="refund-reason">Motivo del Reembolso (obligatorio)</Label>
                            <Textarea
                                id="refund-reason"
                                placeholder="Ej: El cliente se equivocó de modelo, la pieza no funcionó..."
                                value={refundReason}
                                onChange={(e) => setRefundReason(e.target.value)}
                                className="mt-2"
                            />
                        </div>
                        <div>
                            <Label>¿A dónde debe ir el stock devuelto?</Label>
                            <RadioGroup 
                                defaultValue="return" 
                                className="mt-2 space-y-2"
                                value={stockAction}
                                onValueChange={(value: 'return' | 'damage') => setStockAction(value)}
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="return" id="r1" />
                                    <Label htmlFor="r1">Devolver a Stock Disponible (aumenta Stock Total)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="damage" id="r2" />
                                    <Label htmlFor="r2">Mover a Stock Dañado (no afecta Stock Total)</Label>
                                </div>
                            </RadioGroup>
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setRefundReason("")}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRefund} disabled={!refundReason.trim()} className="bg-destructive hover:bg-destructive/90">
                            Sí, confirmar reembolso
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};


const SaleReceiptDialog = ({ sale }: { sale: Sale }) => {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const currency = useCurrency();

    const onPrint = () => {
        const receiptProps = { sale, currency };
        handlePrintReceipt(receiptProps, (error) => {
            toast({
                variant: "destructive",
                title: "Error de Impresión",
                description: error
            });
        });
    }

    return (
        <div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
                <Printer className="w-4 h-4" />
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md p-0">
                    <DialogHeader className="p-4 pb-0">
                        <DialogTitle>Nota de Entrega</DialogTitle>
                    </DialogHeader>
                    <div className="overflow-y-auto p-4">
                        <ReceiptView 
                            sale={sale} 
                            currency={currency}
                        />
                    </div>
                    <div className="p-4 flex gap-2 border-t">
                        <Button onClick={onPrint} variant="outline" className="w-full">
                            <Printer className="mr-2 h-4 w-4" />
                            Imprimir Recibo
                        </Button>
                        <Button onClick={() => setOpen(false)} className="w-full">
                            Cerrar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export function TransactionList({ sales, isLoading }: TransactionListProps) {
    const { format: formatCurrency, getSymbol } = useCurrency();

    if (isLoading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                     <Skeleton key={i} className="h-16 w-full" />
                ))}
            </div>
        )
    }

    if (sales.length === 0) {
        return <p className="text-muted-foreground text-center">No hay transacciones todavía.</p>
    }

    const getPaymentAmountInCorrectCurrency = (payment: Payment) => {
        let symbol = payment.method === 'Efectivo USD' ? getSymbol('USD') : getSymbol('Bs');
        let amount = payment.amount;

        return `${symbol}${formatCurrency(amount, payment.method === 'Efectivo USD' ? 'USD' : 'Bs')}`;
    }

    // Sort sales by date, most recent first
    const sortedSales = [...sales].sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());


    return (
        <Accordion type="single" collapsible className="w-full">
            {sortedSales.map((sale) => (
                <AccordionItem value={sale.id!} key={sale.id}>
                    <AccordionTrigger className={cn(sale.status === 'refunded' && "text-muted-foreground line-through")}>
                        <div className="flex justify-between w-full pr-4">
                            <div className="text-left">
                                <p className="font-semibold">{format(parseISO(sale.transactionDate), "PPP", { locale: es })}</p>
                                <p className="text-xs text-muted-foreground">{sale.id}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                {sale.reconciliationId && <Badge variant="outline" className="border-green-600 text-green-600"><CheckCircle2 className="mr-1 h-3 w-3"/>Cerrada</Badge>}
                                {sale.status === 'refunded' && <Badge variant="destructive">Reembolsado</Badge>}
                                <p className="font-semibold text-lg">{getSymbol()}{formatCurrency(sale.totalAmount)}</p>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        {sale.status === 'refunded' && sale.refundedAt && (
                            <div className="mb-4 p-3 rounded-md border border-destructive/50 bg-destructive/10">
                                <p className="text-sm font-semibold text-destructive">
                                    Reembolsado el {format(parseISO(sale.refundedAt), "PPP p", { locale: es })}
                                </p>
                                {sale.refundReason && <p className="text-sm text-destructive/80 mt-1">Motivo: {sale.refundReason}</p>}
                            </div>
                        )}
                        <div className="flex justify-end items-center mb-2 gap-2">
                            <RefundButton sale={sale} />
                           <SaleReceiptDialog sale={sale} />
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="text-center">Cantidad</TableHead>
                                    <TableHead className="text-right">Precio Unit.</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sale.items.map(item => (
                                    <TableRow key={item.productId}>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell className="text-center">{item.quantity}</TableCell>
                                        <TableCell className="text-right">{getSymbol()}{formatCurrency(item.price)}</TableCell>
                                        <TableCell className="text-right">{getSymbol()}{formatCurrency(item.price * item.quantity)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                         <div className="mt-4 space-y-2 text-sm text-right">
                             <p>Sub-total: {getSymbol()}{formatCurrency(sale.subtotal)}</p>
                             {sale.discount > 0 && <p className="text-destructive">Descuento: -{getSymbol()}{formatCurrency(sale.discount)}</p>}
                             <p className="font-bold text-base">Total: {getSymbol()}{formatCurrency(sale.totalAmount)}</p>
                        </div>
                         <div className="mt-2 space-y-1 text-xs text-right text-muted-foreground">
                            <p className="font-semibold">Pagos:</p>
                            {sale.payments.map((p, i) => <p key={i}>{p.method}{p.reference ? ` (${p.reference})` : ''}: {getPaymentAmountInCorrectCurrency(p)}</p>)}
                            {sale.changeGiven && sale.changeGiven.length > 0 && (
                                <div className="font-semibold text-primary">
                                    <p>Vuelto Entregado:</p>
                                    {sale.changeGiven.map((change, i) => {
                                        const isUSD = change.method === 'Efectivo USD';
                                        const symbol = getSymbol(isUSD ? 'USD' : 'Bs');
                                        const formattedAmount = formatCurrency(change.amount, isUSD ? 'USD' : 'Bs');
                                        return <p key={i} className="pl-2">{change.method}: {symbol}{formattedAmount}</p>
                                    })}
                                </div>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    )
}
