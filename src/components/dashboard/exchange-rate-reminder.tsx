
"use client";

import { useCurrency } from "@/hooks/use-currency";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { differenceInHours } from "date-fns";
import { Button } from "../ui/button";
import Link from "next/link";
import { Skeleton } from "../ui/skeleton";
import { useState, useEffect } from "react";
import { useFirebase, setDocumentNonBlocking } from "@/firebase";
import { doc } from "firebase/firestore";
import type { AppSettings } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";


const UPDATE_THRESHOLD_HOURS = 4;

export function ExchangeRateReminder() {
    const { settings, isLoading, bcvRate, parallelRate } = useCurrency();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isAutoUpdating, setIsAutoUpdating] = useState(false);
    const [showAlert, setShowAlert] = useState(false);

    useEffect(() => {
        const attemptAutoUpdate = async () => {
            if (isLoading || !settings || !firestore) return;

            const hoursSinceUpdate = settings.lastUpdated
                ? differenceInHours(new Date(), new Date(settings.lastUpdated))
                : Infinity;

            if (hoursSinceUpdate > UPDATE_THRESHOLD_HOURS) {
                setIsAutoUpdating(true);
                setShowAlert(false); // Hide alert while attempting update
                try {
                    const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
                    if (!response.ok) throw new Error('Network response was not ok.');
                    
                    const data = await response.json();
                    if (data && data.promedio && data.promedio !== settings.bcvRate) {
                        const settingsRef = doc(firestore, 'app-settings', 'main');
                        const newSettings: AppSettings = {
                            ...settings,
                            bcvRate: data.promedio,
                            lastUpdated: new Date().toISOString(),
                        };
                        // This uses a non-blocking update
                        setDocumentNonBlocking(settingsRef, newSettings, { merge: true });
                        
                        toast({
                            title: "Tasa BCV Actualizada Automáticamente",
                            description: `Nuevo valor: ${data.promedio}. La página se actualizará.`,
                        });
                        // The hook `useDoc` will automatically reflect the change.
                    }
                } catch (error) {
                    console.error("Auto-update failed:", error);
                    // If update fails, show the manual alert
                    setShowAlert(true);
                } finally {
                    setIsAutoUpdating(false);
                }
            } else if (hoursSinceUpdate > 0) {
                 // Rate is old, but not old enough to auto-update, just show alert
                 setShowAlert(true);
            }
        };

        attemptAutoUpdate();

    }, [settings, isLoading, firestore, toast]);


    if (isLoading || isAutoUpdating) {
        return (
            <div className="p-4 border-b">
                 <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="animate-spin h-4 w-4" />
                    Verificando y actualizando tasas de cambio...
                </div>
            </div>
        )
    }
    
    if (!settings || !settings.lastUpdated) {
         return (
            <div className="p-4 border-b">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>¡Atención!</AlertTitle>
                    <AlertDescription className="flex items-center justify-between">
                        <div>
                            Las tasas de cambio nunca han sido configuradas.
                        </div>
                        <Button asChild>
                            <Link href="/dashboard/settings">
                                Configurar Tasas <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }
    
    const hoursSinceUpdate = differenceInHours(new Date(), new Date(settings.lastUpdated));
    if (!showAlert || hoursSinceUpdate < UPDATE_THRESHOLD_HOURS) {
        return null;
    }


    return (
        <div className="p-4 border-b">
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>¡Atención: Falló la Actualización Automática!</AlertTitle>
                <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2">
                    <p>No pudimos actualizar la tasa de cambio automáticamente. Las tasas actuales (BCV: {bcvRate} Bs) podrían estar desactualizadas. Por favor, actualízalas manualmente.</p>
                    <Button asChild className="shrink-0">
                        <Link href="/dashboard/settings">
                            Actualizar Tasas Manualmente <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </AlertDescription>
            </Alert>
        </div>
    );
}
