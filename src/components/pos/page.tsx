"use client";

import { ProductGrid } from "@/components/pos/product-grid";
import { Suspense, useEffect, useState } from "react";
import type { CartItem, Product, RepairJob } from "@/lib/types";
import { CartDisplay } from "@/components/pos/cart-display";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useRouter } from "next/navigation";
import { useCollection, useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { collection, doc, getDoc } from "firebase/firestore";

function POSContent() {
    const { firestore, isUserLoading } = useFirebase();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [cart, setCart] = useState<CartItem[]>([]);
    
    const [activeRepairJob, setActiveRepairJob] = useState<RepairJob | null>(null);

    const productsCollection = useMemoFirebase(() => 
        firestore ? collection(firestore, 'products') : null,
        [firestore]
    );
    const { data: products, isLoading: productsLoading } = useCollection<Product>(productsCollection);
    
    useEffect(() => {
        const repairJobData = searchParams.get('repairJob');
        if (repairJobData && !isUserLoading) {
            try {
                const job: RepairJob = JSON.parse(decodeURIComponent(repairJobData));
                setActiveRepairJob(job);
                const remainingBalance = job.estimatedCost - (job.amountPaid || 0);

                if (remainingBalance > 0) {
                     const repairCartItem: CartItem = {
                        productId: job.id!,
                        name: `Reparación: ${job.deviceMake} ${job.deviceModel}`,
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
            } catch (error) {
                console.error("Error parsing repair job data from URL", error);
                 toast({
                    variant: "destructive",
                    title: "Error de Datos",
                    description: "No se pudieron cargar los datos de la reparación desde la URL.",
                });
                router.push('/dashboard/repairs');
            }
        } else if (!repairJobData) {
            setCart([]);
            setActiveRepairJob(null);
        }

    }, [searchParams, router, toast, isUserLoading]);


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
            return [...prevCart, { productId: product.id!, name: product.name, quantity: 1 }];
        });
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

    const handleUpdatePrice = (productId: string, price: number) => {
        setCart(prevCart => prevCart.map(item => 
            item.productId === productId
            ? { ...item, price: price < 0 ? 0 : price, isGift: price === 0 }
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

    return (
        <div className="h-screen flex flex-col bg-slate-50">
             <header className="bg-white flex h-14 items-center gap-4 border-b px-4 sm:h-16 sm:px-6">
                <div className="flex items-center gap-2">
                    <SidebarTrigger />
                    <h1 className="text-lg font-semibold md:text-xl">Punto de Venta</h1>
                </div>
                 <div className="ml-auto text-sm text-muted-foreground">
                    <span>TabletSP + Lite v 1.0.2</span>
                    <span className="mx-2">|</span>
                    <span>{new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric'})}</span>
                </div>
            </header>
            <main className="flex-1 grid grid-cols-10 gap-0 overflow-hidden">
                <div className="col-span-4 bg-white border-r">
                    <CartDisplay 
                        cart={cart}
                        onUpdateQuantity={handleUpdateQuantity}
                        onUpdatePrice={handleUpdatePrice}
                        onRemoveItem={handleRemoveItem}
                        onClearCart={handleClearCart}
                        repairJobId={activeRepairJob?.id}
                        allProducts={products || []}
                    />
                </div>
                <div className="col-span-6 flex flex-col p-4">
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
