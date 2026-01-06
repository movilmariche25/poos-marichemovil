
"use client";

import type { Table } from "@tanstack/react-table";
import type { Product } from "@/lib/types";
import { Button } from "../ui/button";
import { Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { renderToString } from "react-dom/server";
import { ProductLabel } from "./product-label";
import { useCurrency } from "@/hooks/use-currency";

type PrintLabelsButtonProps = {
    table: Table<Product>;
}

export const handlePrint = (
  products: Product[],
  currency: ReturnType<typeof useCurrency>,
  onError: (message: string) => void
) => {
  const labelsHtml = renderToString(
    <div className="grid grid-cols-4 gap-x-0 gap-y-0">
      {products.map((product) => (
        <ProductLabel key={product.id} product={product} currency={currency} />
      ))}
    </div>
  );

  const printWindow = window.open('', '_blank', 'width=800,height=600');

  if (printWindow) {
    printWindow.document.write(`
        <html>
            <head>
                <title>Etiquetas de Productos</title>
                <style>
                    @media print {
                        @page {
                            size: letter;
                            margin: 0.5in;
                        }
                    }
                    body {
                        margin: 0;
                        font-family: sans-serif;
                    }
                    .grid {
                        display: grid;
                    }
                    .grid-cols-4 {
                        grid-template-columns: repeat(4, 1fr);
                    }
                    .gap-x-0 { column-gap: 0; }
                    .gap-y-0 { row-gap: 0; }
                    .label-container {
                        border: 1px dotted #ccc;
                        padding: 8px 4px;
                        width: 1.75in;
                        height: 1in;
                        box-sizing: border-box;
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        align-items: center;
                        text-align: center;
                    }
                    .product-name {
                        font-size: 10px;
                        font-weight: bold;
                        line-height: 1.2;
                        margin-bottom: 4px;
                        max-height: 3.6em; /* 3 lines */
                        overflow: hidden;
                    }
                    .product-sku {
                        font-size: 8px;
                        margin: 2px 0;
                    }
                    .product-price {
                        font-size: 12px;
                        font-weight: bold;
                        margin: 0;
                    }
                </style>
            </head>
            <body>
                ${labelsHtml}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                           // window.close();
                        }, 100);
                    }
                <\/script>
            </body>
        </html>
    `);
    printWindow.document.close();
  } else {
    onError("No se pudo abrir la ventana de impresión. Revisa si tu navegador está bloqueando las ventanas emergentes.");
  }
};


export function PrintLabelsButton({ table }: PrintLabelsButtonProps) {
    const { toast } = useToast();
    const currency = useCurrency();
    const selectedRows = table.getSelectedRowModel().rows;
    const selectedProducts = selectedRows.map(row => row.original);

    const handlePrintClick = () => {
        if(selectedProducts.length === 0) {
            toast({
                variant: 'destructive',
                title: 'No hay productos seleccionados',
                description: 'Por favor, selecciona al menos un producto para imprimir etiquetas.'
            });
            return;
        }

        handlePrint(selectedProducts, currency, (error) => {
             toast({
                variant: "destructive",
                title: "Error de Impresión",
                description: error,
            });
        });
    }

    return (
        <Button variant="outline" onClick={handlePrintClick} disabled={selectedRows.length === 0}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir Etiquetas ({selectedRows.length})
        </Button>
    )
}
