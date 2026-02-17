
"use client";

import type { Product } from "@/lib/types";
import { Card, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { useMemo, useState, useEffect } from "react";
import { ScrollArea } from "../ui/scroll-area";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";
import { TicketPercent, Search, PackagePlus, Lock, Percent } from "lucide-react";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "../ui/button";


type ProductGridProps = {
  products: Product[];
  onProductSelect: (product: Product) => void;
  isLoading?: boolean;
};

const ITEMS_PER_PAGE = 25;

export function ProductGrid({ products, onProductSelect, isLoading }: ProductGridProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const { format, getSymbol, getFinalPrice } = useCurrency();
  const [currentPage, setCurrentPage] = useState(1);

  const categories = useMemo(() => {
    if (!products) return ['Todos'];
    const cats = products.map(p => p.category);
    return ['Todos', ...Array.from(new Set(cats))];
  }, [products]);

  const [activeCategory, setActiveCategory] = useState('Todos');

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(
        (product) =>
        (activeCategory === 'Todos' || product.category === activeCategory) &&
        (product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (product.compatibleModels && product.compatibleModels.some(model => model.toLowerCase().includes(searchTerm.toLowerCase()))))
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [products, activeCategory, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, searchTerm]);
  
  const { paginatedProducts, totalPages } = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginated = filteredProducts.slice(startIndex, endIndex);
    const pages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
    return { paginatedProducts: paginated, totalPages: pages };
  }, [currentPage, filteredProducts]);

  const getAvailableStock = (product: Product) => {
      if (product.isCombo) {
           if (!product.comboItems || product.comboItems.length === 0 || !products) return 0;
           const stockCounts = product.comboItems.map(item => {
               const component = products.find(p => p.id === item.productId);
               if (!component) return 0;
               const available = component.stockLevel - (component.reservedStock || 0) - (component.damagedStock || 0);
               return Math.floor(available / item.quantity);
           });
           return Math.min(...stockCounts);
      }
      return product.stockLevel - (product.reservedStock || 0) - (product.damagedStock || 0);
  };
  
  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };


  return (
    <div className="flex flex-col h-full">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
            <Select value={activeCategory} onValueChange={setActiveCategory}>
                <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                    {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Buscar por nombre, SKU, modelo compatible..."
                    className="w-full pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>
        <div className="relative flex-1 min-h-0">
          <ScrollArea className="absolute inset-0">
            <div className="flex flex-wrap gap-4 pr-4">
                {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                        <Card key={`skeleton-${i}`} className="w-[150px]">
                            <CardHeader className="p-2">
                               <Skeleton className="h-4 w-3/4" />
                            </CardHeader>
                            <CardFooter className="p-2 flex justify-end">
                                <Skeleton className="h-4 w-1/4" />
                            </CardFooter>
                        </Card>
                    ))
                ) : paginatedProducts.map((product) => {
                    const availableStock = getAvailableStock(product);
                    const promoPrice = (typeof product.promoPrice === 'number' && product.promoPrice > 0) ? product.promoPrice : 0;
                    const hasPromo = promoPrice > 0;
                    
                    const basePrice = getFinalPrice(product);
                    const displayPrice = hasPromo ? promoPrice : basePrice;

                    return (
                        <Card
                            key={product.id}
                            onClick={() => availableStock > 0 && onProductSelect(product)}
                            className={cn(
                                "cursor-pointer hover:border-primary transition-colors flex flex-col justify-between w-[150px]",
                                availableStock <= 0 && "opacity-50 cursor-not-allowed hover:border-input"
                            )}
                        >
                            <CardHeader className="p-2">
                                <CardTitle className="text-sm font-medium leading-tight h-10 flex items-start gap-2">
                                  {product.isCombo && <PackagePlus className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" title="Combo"/>}
                                  {product.isFixedPrice && <Lock className="h-3 w-3 text-amber-500 flex-shrink-0 mt-1" title="Precio Fijo" />}
                                  {product.hasCustomMargin && !product.isFixedPrice && <Percent className="h-3 w-3 text-blue-500 flex-shrink-0 mt-1" title={`Margen Indiv: ${product.customMargin}%`} />}
                                  <span>{product.name}</span>
                                </CardTitle>
                                {product.compatibleModels && product.compatibleModels.length > 0 && (
                                  <p className="text-xs text-muted-foreground truncate pt-1">{product.compatibleModels.join(', ')}</p>
                                )}
                            </CardHeader>
                            <CardFooter className="p-2 flex justify-between items-center mt-auto">
                                <p className="text-xs text-muted-foreground">Disp: {availableStock}</p>
                                <div className={cn("text-xs font-bold", hasPromo && "text-green-600")}>
                                  {hasPromo && <TicketPercent className="w-3 h-3 inline-block mr-1"/>}
                                  {getSymbol()}{format(displayPrice)}
                                </div>
                            </CardFooter>
                        </Card>
                    )
                })}
            </div>
          </ScrollArea>
        </div>
         {totalPages > 1 && (
            <div className="flex items-center justify-end space-x-2 pt-4 flex-shrink-0">
                <span className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                >
                    Anterior
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={currentPage >= totalPages}
                >
                    Siguiente
                </Button>
            </div>
        )}
    </div>
  );
}
