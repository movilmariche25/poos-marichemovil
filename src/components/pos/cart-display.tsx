

"use client";

import type { CartItem, Payment, Product, Sale, RepairJob } from "@/lib/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Trash2, TicketPercent, Gift } from "lucide-react";
import { useState, useEffect } from "react";
import { CheckoutDialog } from "./checkout-dialog";
import { useCurrency } from "@/hooks/use-currency";
import { useRouter } from "next/navigation";
import { ScrollArea } from "../ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { useFirebase, useDoc, useMemoFirebase } from "@/firebase";
import { collection, doc, writeBatch, runTransaction } from "firebase/firestore";
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
  onToggleGift: (productId: string) => void;
  repairJobId?: string;
};

function generateSaleId() {
    const date = new Date();
    const datePart = format(date, "yyMMdd");
    const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
    return `S-${datePart}-${randomPart}`;
}

export function CartDisplay({ cart, allProducts, onUpdateQuantity, onRemoveItem, onClearCart, repairJobId, onTogglePromo, onToggleGift }: CartDisplayProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const { format: formatCurrency, convert, getDynamicPrice, getSymbol } = useCurrency();
  const [discount, setDiscount] = useState(0);
  
  const repairJobRef = useMemoFirebase(() => 
    (repairJobId && firestore) ? doc(firestore, 'repair_jobs', repairJobId) : null,
    [repairJobId, firestore]
  );
  const { data: activeRepairJob } = useDoc<RepairJob>(repairJobRef);

  const getPrice = (item: CartItem) => {
    if (item.isGift) return 0;
    
    if (item.isRepair) {
       if (activeRepairJob) {
            return Math.max(0, activeRepairJob.estimatedCost - (activeRepairJob.amountPaid || 0));
       }
       return 0;
    }
    
    const product = allProducts.find(p => p.id === item.productId);
    if (!product) return 0;
    
    if (item.isPromo && product.promoPrice && product.promoPrice > 0) {
        return product.promoPrice;
    }
    
    return getDynamicPrice(product.costPrice);
  };
  
  const subtotal = cart.reduce((acc, item) => {
      return acc + getPrice(item) * item.quantity;
  }, 0);

  const total = subtotal - discount;


  const handleCheckout = async (payments: Payment[], changeGiven: Payment[], totalChangeInUSD: number): Promise<Sale | null> => {
      if (!firestore) return null;

      const batch = writeBatch(firestore);

      const cartWithFinalPrices = cart.map(item => ({
        ...item,
        price: getPrice(item),
        name: item.isRepair && activeRepairJob 
            ? `Reparación: ${activeRepairJob.deviceMake} ${activeRepairJob.deviceModel} (Costo Total: ${getSymbol()}${formatCurrency(activeRepairJob.estimatedCost)}, Pagado: ${getSymbol()}${formatCurrency(activeRepairJob.amountPaid || 0)})`
            : item.name
      }));

      // In a transaction, update all product stocks
      try {
        await runTransaction(firestore, async (transaction) => {
          for (const item of cartWithFinalPrices) {
            if (item.isRepair && activeRepairJob?.reservedParts) {
                // When a repair is paid, the reserved parts are "consumed".
                // We decrease reserved stock and total stock level.
                for (const part of activeRepairJob.reservedParts) {
                    const productRef = doc(firestore, 'products', part.productId);
                    const productDoc = await transaction.get(productRef);
                    if (productDoc.exists()) {
                        const productData = productDoc.data() as Product;
                        const newReservedStock = (productData.reservedStock || 0) - part.quantity;
                        const newStockLevel = productData.stockLevel - part.quantity;
                        transaction.update(productRef, { 
                            reservedStock: Math.max(0, newReservedStock),
                            stockLevel: Math.max(0, newStockLevel),
                        });
                    }
                }
                continue;
            }

            // For direct sales, we decrement the stock level.
            const productRef = doc(firestore, 'products', item.productId);
            const productDoc = await transaction.get(productRef);
            if (!productDoc.exists()) {
              throw new Error(`Producto ${item.name} no encontrado.`);
            }

            const product = productDoc.data() as Product;
            
            if (product.isCombo && product.comboItems) {
              for (const comboItem of product.comboItems) {
                const componentRef = doc(firestore, 'products', comboItem.productId);
                const componentDoc = await transaction.get(componentRef);
                if (!componentDoc.exists()) {
                   throw new Error(`Componente ${comboItem.productName} del combo no encontrado.`);
                }
                const componentData = componentDoc.data() as Product;
                const quantityToDecrement = comboItem.quantity * item.quantity;
                const newStockLevel = componentData.stockLevel - quantityToDecrement;
                transaction.update(componentRef, { stockLevel: Math.max(0, newStockLevel) });
              }
            } else {
              const newStockLevel = product.stockLevel - item.quantity;
              transaction.update(productRef, { stockLevel: Math.max(0, newStockLevel) });
            }
          }
        });
      } catch (error: any) {
        console.error("Error updating stock during sale:", error);
        toast({
          variant: "destructive",
          title: "Error de Stock",
          description: error.message || "No se pudo actualizar el stock para uno o más productos. La venta ha sido cancelada.",
        });
        return null;
      }
      
      if (repairJobId && activeRepairJob) {
        const repairJobRef = doc(firestore, 'repair_jobs', repairJobId);
        
        const repairItemInCart = cartWithFinalPrices.find(item => item.isRepair);
        const paymentForRepair = repairItemInCart ? (repairItemInCart.price * repairItemInCart.quantity) : 0;
        
        const currentAmountPaid = activeRepairJob.amountPaid || 0;
        const newTotalPaid = currentAmountPaid + paymentForRepair;
        const isNowPaidInFull = newTotalPaid >= activeRepairJob.estimatedCost;

        batch.set(repairJobRef, { 
            status: 'Completado', 
            amountPaid: newTotalPaid,
            isPaid: isNowPaidInFull,
        }, { merge: true });
      }
      
      const saleId = generateSaleId();
      const saleDataObject: Omit<Sale, 'id' | 'status' | 'items'> & { items: (CartItem & { price: number })[] } = {
          items: cartWithFinalPrices,
          subtotal: subtotal,
          discount: discount,
          totalAmount: total,
          paymentMethod: payments.map(p => p.method).join(', '),
          transactionDate: new Date().toISOString(),
          payments: payments,
          ...(repairJobId && { repairJobId }),
          ...(activeRepairJob?.reservedParts && { consumedParts: activeRepairJob.reservedParts }),
          ...(changeGiven && changeGiven.length > 0 && { 
            changeGiven,
            totalChangeInUSD
          }),
      };
      
      const saleRef = doc(firestore, 'sale_transactions', saleId);
      batch.set(saleRef, { ...saleDataObject, id: saleId, status: 'completed' });

      await batch.commit();

      const completedSale: Sale = { ...saleDataObject, id: saleId, status: 'completed' };
      
      setDiscount(0);

      return completedSale;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
        <div className="p-4 border-b bg-white flex-shrink-0">
            <h2 className="text-lg font-semibold">Ticket de Venta</h2>
        </div>
      <ScrollArea className="flex-1 bg-white min-h-0">
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
                        const itemPrice = getPrice(item);
                        const totalItemPrice = itemPrice * item.quantity;
                        const totalItemPriceBs = convert(totalItemPrice, 'USD', 'Bs');
                        
                        let displayName = item.name;
                        let displayDescription = null;

                        if (item.isRepair && activeRepairJob) {
                            displayName = `Reparación: ${activeRepairJob.deviceMake} ${activeRepairJob.deviceModel}`;
                            displayDescription = `(Costo Total: ${getSymbol()}${formatCurrency(activeRepairJob.estimatedCost)}, Pagado: ${getSymbol()}${formatCurrency(activeRepairJob.amountPaid || 0)})`;
                        }

                        return (
                        <TableRow key={item.productId} className={cn(item.isGift && "bg-green-50")}>
                            <TableCell className="font-medium">
                                <div className="flex items-start gap-2">
                                     {product?.isGiftable && !item.isRepair && (
                                        <Button variant="ghost" size="icon" className="w-6 h-6 mt-1" onClick={() => onToggleGift(item.productId)}>
                                            <Gift className={cn("w-4 h-4", item.isGift ? "text-green-600" : "text-muted-foreground")} />
                                        </Button>
                                    )}
                                    <div>
                                        <span>{displayName}</span>
                                        {displayDescription && <div className="text-xs text-muted-foreground">{displayDescription}</div>}
                                    </div>
                                </div>
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
                               <div className="flex items-center justify-end gap-1">
                                    {product?.promoPrice && product.promoPrice > 0 && !item.isRepair && (
                                        <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => onTogglePromo(item.productId)}>
                                            <TicketPercent className={cn("w-4 h-4", item.isPromo ? "text-green-600" : "text-muted-foreground")} />
                                        </Button>
                                    )}
                                    <span>{getSymbol('USD')}{formatCurrency(itemPrice, 'USD')}</span>
                               </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="font-medium">{getSymbol('USD')}{formatCurrency(totalItemPrice, 'USD')}</div>
                                <div className="text-xs text-muted-foreground">Bs {formatCurrency(totalItemPriceBs, 'Bs')}</div>
                            </TableCell>
                            <TableCell>
                               <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => onRemoveItem(item.productId)}>
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
                <span className="font-medium">{getSymbol('USD')}{formatCurrency(subtotal, 'USD')}</span>
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
        <CheckoutDialog 
            cart={cart} 
            allProducts={allProducts} 
            total={total} 
            onCheckout={handleCheckout} 
            onClearCart={onClearCart}
            isRepairSale={!!repairJobId}
        >
            <Button size="lg" disabled={cart.length === 0} className="w-full h-16 text-xl flex flex-col items-center">
                <span className="text-2xl font-bold">PAGAR: {getSymbol('USD')}{formatCurrency(total, 'USD')}</span>
                <span className="text-sm font-normal text-primary-foreground/80">
                    o Bs {formatCurrency(convert(total, 'USD', 'Bs'), 'Bs')}
                </span>
            </Button>
        </CheckoutDialog>
      </div>
    </div>
  );
}
