
"use client";

import type { CartItem, Payment, Product, Sale } from "@/lib/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Trash2, TicketPercent } from "lucide-react";
import { useState } from "react";
import { CheckoutDialog } from "./checkout-dialog";
import { useCurrency } from "@/hooks/use-currency";
import { useRouter } from "next/navigation";
import { ScrollArea } from "../ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { useFirebase } from "@/firebase";
import { collection, doc, getDoc, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { cn } from "@/lib/utils";

type CartDisplayProps = {
  cart: CartItem[];
  allProducts: Product[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onTogglePromo: (productId: string) => void;
  repairJobId?: string;
};

function generateSaleId() {
    const date = new Date();
    const datePart = format(date, "yyMMdd");
    const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
    return `S-${datePart}-${randomPart}`;
}

export function CartDisplay({ cart, allProducts, onUpdateQuantity, onRemoveItem, onClearCart, onTogglePromo, repairJobId }: CartDisplayProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const { format: formatCurrency, convert, currency, bsExchangeRate, isLoading: currencyIsLoading } = useCurrency();
  const [discount, setDiscount] = useState(0);

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const total = subtotal - discount;


  const handleCheckout = async (payments: Payment[]): Promise<Sale | null> => {
      if (!firestore) return null;

      const batch = writeBatch(firestore);

      // Handle stock for regular product sales
      for (const item of cart) {
        if (!item.isRepair && item.productId) {
          const product = allProducts.find(p => p.id === item.productId);
          if (product) {
            const productRef = doc(firestore, 'products', item.productId);
            const newStock = product.stockLevel - item.quantity;
            batch.update(productRef, { stockLevel: newStock });
          }
        }
      }
      
      // Handle repair job completion
      if (repairJobId) {
        const repairJobRef = doc(firestore, 'repair_jobs', repairJobId);
        const repairJobDoc = await getDoc(repairJobRef);
        const repairJobData = repairJobDoc.data();
        
        // Finalize stock for reserved parts
        if (repairJobData && repairJobData.reservedParts && repairJobData.reservedParts.length > 0) {
            for (const part of repairJobData.reservedParts) {
                const productRef = doc(firestore, 'products', part.productId);
                const productDoc = await getDoc(productRef);
                if (productDoc.exists()) {
                    const productData = productDoc.data();
                    const newReservedStock = (productData.reservedStock || 0) - part.quantity;
                    const newStockLevel = productData.stockLevel - part.quantity; // Decrease total stock upon sale completion
                    batch.update(productRef, { 
                        stockLevel: newStockLevel < 0 ? 0 : newStockLevel,
                        reservedStock: newReservedStock < 0 ? 0 : newReservedStock 
                    });
                }
            }
        }
        
        const currentAmountPaid = repairJobData?.amountPaid || 0;
        const totalPaidForRepairThisTransaction = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const newTotalPaid = currentAmountPaid + totalPaidForRepairThisTransaction;

        batch.update(repairJobRef, { 
            status: 'Completado', 
            amountPaid: newTotalPaid,
            isPaid: true,
            reservedParts: [] // Clear reserved parts after completion
        });
      }
      
      const saleId = generateSaleId();
      const saleDataObject: Omit<Sale, 'id' | 'status'> = {
          items: cart,
          subtotal: subtotal,
          discount: discount,
          totalAmount: total,
          paymentMethod: payments.map(p => p.method).join(', '),
          transactionDate: new Date().toISOString(),
          payments: payments,
          ...(repairJobId && { repairJobId }),
      };
      
      const saleRef = doc(firestore, 'sale_transactions', saleId);
      batch.set(saleRef, { ...saleDataObject, id: saleId, status: 'completed' });

      await batch.commit();

      const completedSale: Sale = { ...saleDataObject, id: saleId, status: 'completed' };
      
      if(repairJobId) {
          router.push('/dashboard/repairs');
      }
      
      setDiscount(0);

      return completedSale;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
        <div className="p-4 border-b bg-white flex-shrink-0">
            <h2 className="text-lg font-semibold">Ticket de Venta</h2>
        </div>
      <ScrollArea className="flex-1 bg-white">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-2/5">PRODUCTO</TableHead>
                    <TableHead className="w-1/5 text-center">CANT</TableHead>
                    <TableHead className="w-1/5 text-right">PRECIO</TableHead>
                    <TableHead className="w-1/5 text-right">TOTAL</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {cart.length === 0 ? (
                     <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                            Añade productos para iniciar una venta.
                        </TableCell>
                    </TableRow>
                ) : (
                    cart.map((item) => {
                        const product = allProducts.find(p => p.id === item.productId);
                        const hasPromo = product && product.promoPrice && product.promoPrice > 0;
                        const priceInBs = convert(item.price, 'USD', 'Bs');
                        return (
                        <TableRow key={item.productId}>
                            <TableCell className="font-medium flex items-center gap-2">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className={cn(
                                        "w-6 h-6",
                                        !hasPromo && "opacity-25 cursor-default hover:bg-transparent",
                                        item.isPromo && "text-green-600"
                                    )}
                                    onClick={() => hasPromo && onTogglePromo(item.productId)}
                                >
                                    <TicketPercent className="w-4 h-4" />
                                </Button>
                                {item.name}
                            </TableCell>
                            <TableCell className="text-center">
                                <Input 
                                    type="number" 
                                    value={item.quantity} 
                                    onChange={(e) => onUpdateQuantity(item.productId, parseInt(e.target.value))}
                                    className="w-16 text-center"
                                    disabled={item.isRepair}
                                />
                            </TableCell>
                            <TableCell className="text-right">
                                <div className={cn("font-medium", item.isPromo && "text-green-600")}>${formatCurrency(item.price)}</div>
                                <div className="text-xs text-muted-foreground">Bs {formatCurrency(priceInBs, 'Bs')}</div>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="font-medium">${formatCurrency(item.price * item.quantity)}</div>
                                <div className="text-xs text-muted-foreground">Bs {formatCurrency(priceInBs * item.quantity, 'Bs')}</div>
                            </TableCell>
                            <TableCell>
                               <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => onRemoveItem(item.productId)} disabled={item.isRepair}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                            </TableCell>
                        </TableRow>
                        )
                    })
                )}
            </TableBody>
        </Table>
      </ScrollArea>
      <div className="flex-none p-4 border-t bg-gray-50 space-y-2 flex-shrink-0">
        <div className="flex justify-between text-sm">
            <span>Sub-Total</span>
            <div className="text-right">
                <span className="font-medium">${formatCurrency(subtotal)}</span>
                <span className="text-xs text-muted-foreground block">Bs {formatCurrency(convert(subtotal, 'USD', 'Bs'), 'Bs')}</span>
            </div>
        </div>
         <div className="flex justify-between text-sm items-center">
            <span>Descuento $</span>
            <Input 
                type="number"
                value={discount || ''}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="w-24 h-8 text-right"
                placeholder="0.00"
            />
        </div>
        <CheckoutDialog cart={cart} total={total} onCheckout={handleCheckout} onClearCart={onClearCart}>
            <Button size="lg" disabled={cart.length === 0} className="w-full h-16 text-xl flex flex-col items-center">
                <span className="text-2xl font-bold">PAGAR: ${formatCurrency(total)}</span>
                <span className="text-sm font-normal text-primary-foreground/80">
                    o Bs {formatCurrency(convert(total, 'USD', 'Bs'), 'Bs')}
                </span>
            </Button>
        </CheckoutDialog>
      </div>
    </div>
  );
}

    
