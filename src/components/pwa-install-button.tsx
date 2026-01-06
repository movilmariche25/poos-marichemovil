
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) {
      return;
    }
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast({
        title: '¡Aplicación Instalada!',
        description: 'La aplicación se ha añadido a tu escritorio.',
      });
    }
    setInstallPrompt(null);
  };

  if (!isClient || !installPrompt) {
    return null;
  }

  return (
    <Button onClick={handleInstallClick} className="w-full justify-start">
      <Download className="mr-2 h-4 w-4" />
      Instalar Aplicación
    </Button>
  );
}
