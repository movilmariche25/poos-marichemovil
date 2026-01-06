
"use client";

import { useCurrency } from "@/hooks/use-currency";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ArrowRight } from "lucide-react";
import { differenceInHours } from "date-fns";
import { Button } from "../ui/button";
import Link from "next/link";
import { Skeleton } from "../ui/skeleton";

// The reminder will show if the exchange rate is older than this many hours
const REMINDER_THRESHOLD_HOURS = 4;

export function ExchangeRateReminder() {
    const { settings, isLoading, bcvRate, parallelRate } = useCurrency();

    if (isLoading) {
        return (
            <div className="p-4 border-b">
                <Skeleton className="h-24 w-full" />
            </div>
        )
    }

    if (!settings || !settings.lastUpdated) {
        // If settings are not loaded or never updated, show a default alert
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

    if (hoursSinceUpdate < REMINDER_THRESHOLD_HOURS) {
        // If the rate is fresh, don't show anything
        return null;
    }

    return (
        <div className="p-4 border-b">
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>¡Tasas de Cambio Desactualizadas!</AlertTitle>
                <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2">
                    <p>Las tasas actuales (BCV: {bcvRate} Bs, Paralelo: {parallelRate} Bs) no han sido actualizadas en más de {REMINDER_THRESHOLD_HOURS} horas. Actualízalas para asegurar precios correctos.</p>
                    <Button asChild className="shrink-0">
                        <Link href="/dashboard/settings">
                            Actualizar Tasas Ahora <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </AlertDescription>
            </Alert>
        </div>
    );
}

    