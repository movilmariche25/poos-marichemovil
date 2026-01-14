
"use client";

import { useDoc, useFirebase, useMemoFirebase } from "@/firebase";
import type { Currency, AppSettings } from "@/lib/types";
import { doc } from "firebase/firestore";
import { useCallback } from "react";

export const useCurrency = () => {
    const { firestore } = useFirebase();
    const settingsRef = useMemoFirebase(() => 
        firestore ? doc(firestore, 'app-settings', 'main') : null,
        [firestore]
    );
    const { data: settings, isLoading } = useDoc<AppSettings>(settingsRef);

    const currency = settings?.currency || 'USD';
    const bcvRate = settings?.bcvRate || 1; // Tasa Oficial
    const parallelRate = settings?.parallelRate || 1; // Tasa de Reposicion
    const profitMargin = settings?.profitMargin || 100; // Margen de Ganancia

    const format = (value: number, targetCurrency?: Currency) => {
        const c = targetCurrency || currency;
        
        let displayValue = value;
        
        // Using 'de-DE' locale to enforce dot for thousands and comma for decimals,
        // which is the standard format used in Venezuela. 'es-VE' is inconsistent across browsers.
        const formatter = new Intl.NumberFormat('de-DE', {
            style: 'decimal',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

        return formatter.format(displayValue);
    };

    const getSymbol = (targetCurrency?: Currency) => {
        const c = targetCurrency || currency;
        return c === 'Bs' ? 'Bs' : '$';
    }

    const convert = (value: number, from: Currency, to: Currency) => {
        if (from === to) return value;
        if (from === 'USD' && to === 'Bs') return value * bcvRate;
        if (from === 'Bs' && to === 'USD') return value / bcvRate;
        return value;
    }

    const getDynamicPrice = useCallback((costPrice: number) => {
        if (!settings || costPrice <= 0) return 0;
        // Precio_Final_BCV = ((Costo_USD * Tasa_Reposicion) * (1 + Margen_Ganancia)) / Tasa_BCV
        const costInBs = costPrice * parallelRate;
        const priceWithProfitInBs = costInBs * (1 + profitMargin / 100);
        const finalPriceInBcvUsd = priceWithProfitInBs / bcvRate;
        return parseFloat(finalPriceInBcvUsd.toFixed(2));
    }, [settings, parallelRate, profitMargin, bcvRate]);

    return {
        format,
        getSymbol,
        convert,
        getDynamicPrice,
        currency,
        bcvRate, // Exposed for display
        parallelRate, // Exposed for calculation
        profitMargin, // Exposed for calculation
        isLoading,
        settings
    };
}
