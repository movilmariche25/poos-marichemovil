
"use client";

import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const ADMIN_PASSWORD = "Mayra*230499";

type AdminAuthDialogProps = {
  children: ReactNode;
  onAuthorized: () => void;
};

export function AdminAuthDialog({ children, onAuthorized }: AdminAuthDialogProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  const handleAuth = () => {
    if (password === ADMIN_PASSWORD) {
      toast({
        title: "Acceso Concedido",
        description: "Acción de administrador autorizada.",
      });
      setOpen(false);
      onAuthorized();
    } else {
      toast({
        variant: "destructive",
        title: "Acceso Denegado",
        description: "La contraseña de administrador es incorrecta.",
      });
    }
    setPassword("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleAuth();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Autenticación de Administrador</DialogTitle>
          <DialogDescription>
            Esta acción requiere privilegios de administrador. Por favor, introduce la contraseña para continuar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="admin-password">Contraseña de Administrador</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="submit" onClick={handleAuth}>Autorizar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
