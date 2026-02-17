
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

type CustomItemDialogProps = {
  onAddCustomItem: (name: string, price: number, costPrice: number) => void;
};

export function CustomItemDialog({ onAddCustomItem }: CustomItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<string>("");
  const [costPrice, setCostPrice] = useState<string>("");

  const handleAdd = () => {
    const priceNum = parseFloat(price);
    const costNum = parseFloat(costPrice) || 0;
    if (name.trim() && !isNaN(priceNum)) {
      onAddCustomItem(name.trim(), priceNum, costNum);
      setName("");
      setPrice("");
      setCostPrice("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Añadir Artículo Manual">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Venta Rápida (Sin Inventario)</DialogTitle>
          <DialogDescription>
            Añade un artículo al carrito de forma manual ingresando su nombre, costo y precio de venta en dólares.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="custom-name">Nombre del Producto / Servicio</Label>
            <Input
              id="custom-name"
              placeholder="Ej: Cable Genérico, Limpieza..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="custom-cost">Costo en $ (Opcional)</Label>
              <Input
                id="custom-cost"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-price">Precio Venta en $</Label>
              <Input
                id="custom-price"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleAdd} disabled={!name.trim() || !price}>
            Añadir al Carrito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
