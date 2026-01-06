
"use client";

import { ProductGrid } from "@/components/pos/product-grid";
import { Suspense, useEffect, useState } from "react";
import type { CartItem, Product, RepairJob, HeldSale } from "@/lib/types";
import { CartDisplay } from "@/components/pos/cart-display";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useRouter } from "next/navigation";
import { useCollection, useFirebase, useMemoFirebase, deleteDocumentNonBlocking, setDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { ParkingSquare } from "lucide-react";
import { HoldSaleDialog } from "@/components/pos/hold-sale-dialog";
import { HeldSalesSheet } from "@/components/pos/held-sales-sheet";
import { useCurrency } from "@/hooks/use-currency";

function POSContent() {
    const { firestore, isUserLoading } = useFirebase();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [cart, setCart] = useState<CartItem[]>([]);
    const { getDynamicPrice } = useCurrency();
    
    const [activeRepairJob, setActiveRepairJob] = useState<RepairJob | null>(null);

    const productsCollection = useMemoFirebase(() => 
        firestore ? collection(firestore, 'products') : null,
        [firestore]
    );
    const { data: products, isLoading: productsLoading } = useCollection<Product>(productsCollection);
    
    const heldSalesCollection = useMemoFirebase(() => 
        firestore ? collection(firestore, 'held_sales') : null,
        [firestore]
    );
    const { data: heldSales, isLoading: heldSalesLoading } = useCollection<HeldSale>(heldSalesCollection);

    useEffect(() => {
        const repairJobData = searchParams.get('repairJob');
        const restoredSaleId = searchParams.get('restoredSaleId');

        if (restoredSaleId && heldSales && !isUserLoading) {
            const saleToRestore = heldSales.find(s => s.id === restoredSaleId);
            if (saleToRestore) {
                setCart(saleToRestore.items);
                // Remove the restored sale
                if(firestore) {
                    const saleRef = doc(firestore, 'held_sales', restoredSaleId);
                    deleteDocumentNonBlocking(saleRef);
                }
                 // Remove the router.replace to prevent the cart from being cleared
            }
        } else if (repairJobData && !isUserLoading) {
            try {
                // Ensure repairJobData is not empty or malformed before parsing
                if (repairJobData) {
                    const job: RepairJob = JSON.parse(decodeURIComponent(repairJobData));
                    setActiveRepairJob(job);
                    const remainingBalance = job.estimatedCost - (job.amountPaid || 0);

                    if (remainingBalance > 0) {
                         const repairCartItem: CartItem = {
                            productId: job.id!,
                            name: `Reparación: ${job.deviceMake} ${job.deviceModel}`,
                            price: remainingBalance,
                            quantity: 1,
                            isRepair: true,
                        };
                        setCart([repairCartItem]);
                    } else {
                         toast({
                            title: "Reparación ya Pagada",
                            description: "Esta reparación no tiene saldo pendiente.",
                        });
                        router.push('/dashboard/repairs');
                    }
                }
            } catch (error) {
                console.error("Error parsing repair job data from URL", error);
                 toast({
                    variant: "destructive",
                    title: "Error de Datos",
                    description: "No se pudieron cargar los datos de la reparación desde la URL.",
                });
                router.push('/dashboard/repairs');
            }
        } else if (!repairJobData && !restoredSaleId) {
            setCart([]);
            setActiveRepairJob(null);
        }

    }, [searchParams, router, toast, isUserLoading, heldSales, firestore]);


    const handleProductSelect = (product: Product) => {
        const availableStock = product.stockLevel - (product.reservedStock || 0);
        if(availableStock <= 0) {
            toast({
                variant: "destructive",
                title: "Sin Stock",
                description: `${product.name} no tiene stock disponible.`,
            });
            return;
        }

        const salePrice = (product.retailPrice && product.retailPrice > 0)
            ? product.retailPrice
            : getDynamicPrice(product.costPrice);

        setCart(prevCart => {
            if (prevCart.some(item => item.isRepair)) {
                toast({
                    variant: "destructive",
                    title: "Acción no permitida",
                    description: "No se pueden añadir otros productos al cobrar una reparación.",
                });
                return prevCart;
            }

            const existingItem = prevCart.find(item => item.productId === product.id);
            if (existingItem) {
                if(existingItem.quantity >= availableStock) {
                    toast({
                        variant: "destructive",
                        title: "Stock Máximo Alcanzado",
                        description: `No puedes añadir más de ${availableStock} unidades de ${product.name}.`,
                    });
                    return prevCart;
                }
                return prevCart.map(item => 
                    item.productId === product.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
                );
            }
            
            return [...prevCart, { productId: product.id!, name: product.name, price: salePrice, quantity: 1, isPromo: false }];
        });
    };

    const handleTogglePromo = (productId: string) => {
        const product = products?.find(p => p.id === productId);
        if (!product || !product.promoPrice || product.promoPrice <= 0) {
            toast({
                variant: "destructive",
                title: "Sin Precio Promocional",
                description: "Este producto no tiene un precio de oferta configurado."
            });
            return;
        };
        
        const salePrice = (product.retailPrice && product.retailPrice > 0)
            ? product.retailPrice
            : getDynamicPrice(product.costPrice);

        setCart(prevCart => prevCart.map(item => {
            if (item.productId === productId) {
                const isPromo = !item.isPromo;
                return {
                    ...item,
                    isPromo: isPromo,
                    price: isPromo ? product.promoPrice! : salePrice
                };
            }
            return item;
        }));
    };

    const handleUpdateQuantity = (productId: string, quantity: number) => {
        const cartItem = cart.find(item => item.productId === productId);
        if (cartItem?.isRepair) return; 

        const product = products?.find(p => p.id === productId);
        if(!product) return;

        if (quantity <= 0) {
            handleRemoveItem(productId);
            return;
        }

        const availableStock = product.stockLevel - (product.reservedStock || 0);
        if(quantity > availableStock) {
             toast({
                variant: "destructive",
                title: "Stock Insuficiente",
                description: `Solo hay ${availableStock} unidades de ${product.name} disponibles.`,
            });
            return;
        }

        setCart(prevCart => prevCart.map(item => 
            item.productId === productId
            ? { ...item, quantity }
            : item
        ));
    };

    const handleRemoveItem = (productId: string) => {
        const cartItem = cart.find(item => item.productId === productId);
        if(cartItem?.isRepair) {
             toast({
                variant: "destructive",
                title: "Acción no permitida",
                description: "No se puede eliminar el cobro de reparación del carrito.",
            });
            return;
        };

        setCart(prevCart => prevCart.filter(item => item.productId !== productId));
    };

    const handleClearCart = () => {
        if (activeRepairJob || cart.some(c => c.isRepair)) {
            toast({
                variant: "destructive",
                title: "Acción no permitida",
                description: "El cobro de reparación no se puede eliminar. Cancela desde la página de reparaciones si es necesario.",
            });
            router.push('/dashboard/repairs');
        } else {
            setCart([]);
        }
    }
    
    const handleHoldSale = async (name: string) => {
        if (!firestore || cart.length === 0) return;

        const heldSalesCol = collection(firestore, 'held_sales');
        const newHeldSaleDocRef = doc(heldSalesCol); // Create a new doc ref with an auto-generated ID

        const newHeldSale: HeldSale = {
            id: newHeldSaleDocRef.id,
            name,
            items: cart,
            createdAt: new Date().toISOString()
        };

        setDocumentNonBlocking(newHeldSaleDocRef, newHeldSale);

        toast({
            title: "Venta Aparcada",
            description: `La venta "${name}" ha sido guardada.`
        });
        setCart([]);
    }

    return (
        <div className="flex flex-col h-screen bg-slate-50">
             <header className="bg-white flex h-14 items-center gap-4 border-b px-4 sm:h-16 sm:px-6 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <SidebarTrigger />
                    <h1 className="text-lg font-semibold md:text-xl">Punto de Venta</h1>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <HeldSalesSheet heldSales={heldSales || []} />
                    <HoldSaleDialog onHoldSale={handleHoldSale} disabled={cart.length === 0 || cart.some(c => c.isRepair)}>
                        <Button variant="outline">
                            <ParkingSquare className="mr-2 h-4 w-4" />
                            Aparcar Venta
                        </Button>
                    </HoldSaleDialog>
                </div>
            </header>
            <main className="flex-1 grid grid-cols-10 gap-0 overflow-hidden">
                <div className="col-span-4 bg-white border-r h-full">
                    <CartDisplay 
                        cart={cart}
                        allProducts={products || []}
                        onUpdateQuantity={handleUpdateQuantity}
                        onRemoveItem={handleRemoveItem}
                        onClearCart={handleClearCart}
                        onTogglePromo={handleTogglePromo}
                        repairJobId={activeRepairJob?.id}
                    />
                </div>
                <div className="col-span-6 flex flex-col p-4 h-full">
                     <ProductGrid products={products || []} onProductSelect={handleProductSelect} isLoading={productsLoading} />
                </div>
            </main>
        </div>
    )
}

export default function POSPage() {
    return (
        <Suspense fallback={<div>Cargando punto de venta...</div>}>
            <POSContent />
        </Suspense>
    )
}
