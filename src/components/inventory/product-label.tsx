
import type { Product } from "@/lib/types";
import { useCurrency } from "@/hooks/use-currency";

type ProductLabelProps = {
    product: Product;
    currency: ReturnType<typeof useCurrency>;
}

export function ProductLabel({ product, currency }: ProductLabelProps) {
    const { format, getSymbol, getDynamicPrice } = currency;
    
    let price = product.retailPrice;
    if (!price || price <= 0) {
        price = getDynamicPrice(product.costPrice);
    }
    if (product.promoPrice && product.promoPrice > 0) {
        price = product.promoPrice;
    }

    return (
        <div className="label-container">
            <p className="product-name">{product.name}</p>
            <p className="product-sku">{product.sku}</p>
            <p className="product-price">{getSymbol()}{format(price)}</p>
        </div>
    )
}
