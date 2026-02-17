
"use client";

import { useCurrency } from "@/hooks/use-currency";
import { AlertCircle, Loader2, TrendingUp, Clock, RefreshCw } from "lucide-react";
import { differenceInHours } from "date-fns";
import { Button } from "../ui/button";
import { useState, useEffect } from "react";
import { useFirebase, setDocumentNonBlocking } from "@/firebase";
import { doc } from "firebase/firestore";
import type { AppSettings } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const UPDATE_THRESHOLD_HOURS = 4;

export function ExchangeRateReminder() {
    const { settings, isLoading, bcvRate, parallelRate } = useCurrency();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [isAutoUpdating, setIsAutoUpdating] = useState(false);
    const [apiBcvRate, setApiBcvRate] = useState<number | null>(null);
    const [isFetchingApi, setIsFetchingApi] = useState(false);

    const fetchApiRate = async () => {
        setIsFetchingApi(true);
        try {
            // Usando la API oficial de DolarApi para Venezuela (BCV)
            const response = await fetch('https://ve.dolarapi.com/v1/dolares/bcv');
            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            if (data && data.promedio) {
                setApiBcvRate(data.promedio);
                return data.promedio;
            }
        } catch (error) {
            console.error("Failed to fetch API rate:", error);
        } finally {
            setIsFetchingApi(false);
        }
        return null;
    };

    useEffect(() => {
        const checkAndSync = async () => {
            if (isLoading || !settings || !firestore) return;

            const liveRate = await fetchApiRate();
            if (!liveRate) return;

            // Lógica de actualización automática basada en el ajuste de configuración
            if (settings.autoUpdateBcv) {
                const hoursSinceUpdate = settings.lastUpdated
                    ? differenceInHours(new Date(), new Date(settings.lastUpdated))
                    : Infinity;

                // Solo actualizamos si han pasado más de 4 horas o si hay una diferencia significativa (> 0.01)
                if (hoursSinceUpdate >= UPDATE_THRESHOLD_HOURS || Math.abs(liveRate - settings.bcvRate) > 0.01) {
                    setIsAutoUpdating(true);
                    try {
                        const settingsRef = doc(firestore, 'app-settings', 'main');
                        const newSettings: AppSettings = {
                            ...settings,
                            bcvRate: liveRate,
                            lastUpdated: new Date().toISOString(),
                        };
                        setDocumentNonBlocking(settingsRef, newSettings, { merge: true });
                        
                        toast({
                            title: "BCV Actualizado Automáticamente",
                            description: `La tasa del sistema se sincronizó con la API: ${liveRate} Bs.`,
                        });
                    } catch (e) {
                        console.error("Auto-sync failed:", e);
                    } finally {
                        setIsAutoUpdating(false);
                    }
                }
            }
        };

        checkAndSync();
        // Verificamos cada 1 hora si hay cambios en la API
        const interval = setInterval(checkAndSync, 3600000);
        return () => clearInterval(interval);

    }, [settings?.autoUpdateBcv, isLoading, firestore, toast]);

    const handleManualSync = async () => {
        if (!apiBcvRate || !settings || !firestore) return;
        
        setIsAutoUpdating(true);
        const settingsRef = doc(firestore, 'app-settings', 'main');
        const newSettings: AppSettings = {
            ...settings,
            bcvRate: apiBcvRate,
            lastUpdated: new Date().toISOString(),
        };
        setDocumentNonBlocking(settingsRef, newSettings, { merge: true });
        
        toast({
            title: "Sincronización Manual",
            description: `Tasa BCV actualizada a ${apiBcvRate} Bs.`,
        });
        setIsAutoUpdating(false);
    };


    if (isLoading) {
        return (
            <div className="p-2 border-b bg-muted/20">
                 <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Consultando tasa oficial...
                </div>
            </div>
        )
    }
    
    // Determinamos si hay una discrepancia entre lo que dice la API y lo que tiene el sistema
    const needsSync = apiBcvRate && Math.abs(apiBcvRate - bcvRate) > 0.01;

    return (
        <div className="flex flex-col border-b sticky top-0 z-[40] bg-white shadow-sm">
            {/* Barra de Tasa Principal */}
            <div className="bg-primary/5 px-4 py-2 flex flex-wrap items-center justify-between gap-y-2">
                <div className="flex items-center gap-4 sm:gap-8 overflow-x-auto no-scrollbar">
                    {/* TASA BCV ACTUAL EN EL SISTEMA */}
                    <div className="flex items-center gap-2 shrink-0">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold leading-none">BCV Sistema</span>
                            <span className="font-bold text-sm text-primary tabular-nums">{bcvRate.toFixed(2)} Bs</span>
                        </div>
                    </div>

                    {/* TASA BCV REAL (DE LA API) */}
                    <div className={cn(
                        "flex items-center gap-2 px-3 py-1 rounded-md transition-colors shrink-0",
                        needsSync ? "bg-amber-100" : "bg-green-50"
                    )}>
                        {isFetchingApi ? <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" /> : <div className={cn("w-2 h-2 rounded-full", needsSync ? "bg-amber-500 animate-pulse" : "bg-green-500")} />}
                        <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold leading-none">BCV Real (API)</span>
                            <span className="font-bold text-sm tabular-nums">
                                {apiBcvRate ? `${apiBcvRate.toFixed(2)} Bs` : "..."}
                            </span>
                        </div>
                        {needsSync && !settings?.autoUpdateBcv && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 ml-1 text-amber-700 hover:bg-amber-200" 
                                onClick={handleManualSync}
                                title="Sincronizar con tasa oficial"
                                disabled={isAutoUpdating}
                            >
                                <RefreshCw className={cn("w-3 h-3", isAutoUpdating && "animate-spin")} />
                            </Button>
                        )}
                    </div>

                    {/* TASA DE REPOSICION (TOTALMENTE MANUAL) */}
                    <div className="flex items-center gap-2 shrink-0 border-l pl-4 border-slate-200">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold leading-none">Reposición (Manual)</span>
                            <span className="font-bold text-sm tabular-nums text-slate-700">{parallelRate.toFixed(2)} Bs</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {isAutoUpdating && (
                        <div className="flex items-center gap-1 text-primary animate-pulse text-xs font-bold">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Sincronizando...</span>
                        </div>
                    )}
                    {settings?.lastUpdated && (
                        <div className="hidden md:flex items-center gap-1.5 text-muted-foreground text-[10px] bg-slate-100 px-2 py-1 rounded">
                            <Clock className="w-3 h-3" />
                            <span className="font-medium">Ref: {new Date(settings.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Aviso de Configuración Crítica (Solo si no hay datos guardados) */}
            {(!settings || !settings.lastUpdated) && (
                <div className="bg-destructive px-4 py-2 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-white">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <p className="text-xs font-bold uppercase">¡Atención! Tasas no configuradas inicialmente en la base de datos.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
