"use client";

import { useState } from "react";
import { addDays, format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, FileDown } from "lucide-react";
import type { Product, Sale } from "@/lib/types";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";
import { useCurrency } from "@/hooks/use-currency";

type ExportSalesButtonProps = {
  sales: Sale[];
  products: Product[];
};

export function ExportSalesButton({ sales, products }: ExportSalesButtonProps) {
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });
  const { convert } = useCurrency();

  const handleExport = () => {
    if (!date?.from || !date?.to) {
      alert("Por favor, selecciona un rango de fechas.");
      return;
    }

    const filteredSales = sales.filter((sale) => {
      const saleDate = new Date(sale.transactionDate);
      return saleDate >= date.from! && saleDate <= date.to!;
    });
    
    const dataToExport = filteredSales.flatMap(sale => {
        return sale.items.map(item => {
            const product = products.find(p => p.id === item.productId);
            const costPrice = item.isRepair ? 0 : (product?.costPrice || 0);
            const profit = (item.price * item.quantity) - (costPrice * item.quantity);
            const payments = sale.payments.map(p => `${p.method}: ${p.amount}`).join('; ');
            const totalBs = convert(sale.totalAmount, 'USD', 'Bs');

            return {
                'ID Venta': sale.id,
                'Fecha': format(new Date(sale.transactionDate), 'yyyy-MM-dd HH:mm:ss'),
                'Estado': sale.status,
                'Producto ID': item.productId,
                'Producto Nombre': item.name,
                'Cantidad': item.quantity,
                'Precio Unitario ($)': item.price,
                'Costo Unitario ($)': costPrice,
                'Total Producto ($)': item.price * item.quantity,
                'Ganancia Producto ($)': profit,
                'Subtotal Venta ($)': sale.subtotal,
                'Descuento Venta ($)': sale.discount,
                'Total Venta ($)': sale.totalAmount,
                'Total Venta (Bs)': totalBs,
                'Pagos': payments,
                'ID Reparación': sale.repairJobId || '',
                'Motivo Reembolso': sale.refundReason || ''
            }
        })
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ventas");
    
    // Auto-size columns
    const cols = Object.keys(dataToExport[0] || {});
    const colWidths = cols.map(col => ({
        wch: Math.max(...dataToExport.map(row => (row[col as keyof typeof row] ?? '').toString().length), col.length)
    }));
    worksheet["!cols"] = colWidths;


    XLSX.writeFile(workbook, `Ventas_${format(date.from, "yyyy-MM-dd")}_a_${format(date.to, "yyyy-MM-dd")}.xlsx`);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className="w-full sm:w-[300px] justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y", { locale: es })} -{" "}
                  {format(date.to, "LLL dd, y", { locale: es })}
                </>
              ) : (
                format(date.from, "LLL dd, y", { locale: es })
              )
            ) : (
              <span>Selecciona una fecha</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
            locale={es}
          />
        </PopoverContent>
      </Popover>
      <Button onClick={handleExport} disabled={!date?.from || !date?.to}>
        <FileDown className="mr-2 h-4 w-4" />
        Exportar a Excel
      </Button>
    </div>
  );
}
