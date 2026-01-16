
"use client";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useDoc, useFirebase, useMemoFirebase, setDocumentNonBlocking } from "@/firebase";
import { doc } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { AppSettings } from "@/lib/types";

const settingsSchema = z.object({
    bcvRate: z.coerce.number().positive("La tasa BCV debe ser un número positivo."),
    parallelRate: z.coerce.number().positive("La tasa de reposición debe ser un número positivo."),
    profitMargin: z.coerce.number().min(0, "El margen de ganancia no puede ser negativo."),
    lastUpdated: z.string().optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const [isFetchingRate, setIsFetchingRate] = useState(false);
    
    const settingsRef = useMemoFirebase(() => 
        firestore ? doc(firestore, 'app-settings', 'main') : null,
        [firestore]
    );
    const { data: settings, isLoading } = useDoc<AppSettings>(settingsRef);

    const form = useForm<SettingsFormData>({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            bcvRate: 1,
            parallelRate: 1,
            profitMargin: 100,
        }
    });

    useEffect(() => {
        if (settings) {
            // Ensure currency is not part of the form data being reset
            const { currency, ...formData } = settings;
            form.reset(formData);
        }
    }, [settings, form]);


    const handleSettingsSave = (values: SettingsFormData) => {
        if (!settingsRef) return;
        const updatedValues = {
            ...settings, // include existing settings like 'currency'
            ...values,
            lastUpdated: new Date().toISOString()
        };
        setDocumentNonBlocking(settingsRef, updatedValues, { merge: true });
        toast({
            title: "Configuración Guardada",
            description: "La configuración de tasas y margen de ganancia ha sido actualizada.",
        });
    }

    const handleUpdateBcvRate = async () => {
        setIsFetchingRate(true);
        try {
            const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
            if (!response.ok) {
                throw new Error(`Error de red: ${response.statusText}`);
            }
            const data = await response.json();
            
            if (data && data.promedio) {
                form.setValue('bcvRate', data.promedio, { shouldValidate: true });
                toast({
                    title: "Tasa BCV Actualizada",
                    description: `Nuevo valor: ${data.promedio}. Guarda los cambios para aplicar.`,
                });
            } else {
                 throw new Error("Formato de respuesta de API inesperado.");
            }
        } catch (error) {
            console.error("Error al obtener la tasa BCV:", error);
            toast({
                variant: "destructive",
                title: "Error al Actualizar Tasa",
                description: "No se pudo obtener la tasa desde la API. Por favor, inténtalo de nuevo o introdúcela manualmente.",
            });
        } finally {
            setIsFetchingRate(false);
        }
    };


    const handleResetData = () => {
        toast({
            variant: "destructive",
            title: "Acción no implementada",
            description: "El reseteo de datos debe configurarse en el backend por seguridad.",
        });
    }

    return (
        <>
            <PageHeader title="Configuración" />
            <main className="flex-1 p-4 sm:p-6 space-y-6">
                <Card className="max-w-2xl">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSettingsSave)}>
                            <CardHeader>
                                <CardTitle>Tasas de Cambio y Precios</CardTitle>
                                <CardDescription>
                                    Configura las tasas de cambio y el margen de ganancia para el cálculo de precios.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {isLoading ? <p>Cargando configuración...</p> :
                                <>
                                <FormField
                                    control={form.control}
                                    name="bcvRate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Tasa Oficial (BCV)</FormLabel>
                                            <div className="flex items-center gap-2">
                                                <FormControl>
                                                    <Input type="number" step="0.01" placeholder="Ej: 36.50" {...field} />
                                                </FormControl>
                                                <Button type="button" variant="outline" size="icon" onClick={handleUpdateBcvRate} disabled={isFetchingRate}>
                                                    {isFetchingRate ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                                                </Button>
                                            </div>
                                            <FormDescription>La tasa utilizada para la facturación final.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="parallelRate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Tasa de Reposición (Paralelo)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" placeholder="Ej: 40.00" {...field} />
                                                </FormControl>
                                            <FormDescription>La tasa real para calcular el costo de reposición del dólar.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="profitMargin"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Margen de Ganancia (%)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="1" placeholder="Ej: 100" {...field} />
                                                </FormControl>
                                            <FormDescription>El porcentaje de ganancia sobre el costo real. (100 = 100% de ganancia).</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                </>}
                            </CardContent>
                            <CardFooter className="border-t px-6 py-4">
                                <Button type="submit" disabled={form.formState.isSubmitting || isLoading}>Guardar Cambios</Button>
                            </CardFooter>
                        </form>
                    </Form>
                </Card>

                <Card className="max-w-2xl">
                    <CardHeader>
                        <CardTitle>Zona de Peligro</CardTitle>
                        <CardDescription>
                            Estas acciones son destructivas y no se pueden deshacer.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Restablecer Todos los Datos
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>¿Estás absolutely seguro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta acción es irreversible y debe ser manejada a través de funciones de backend seguras, lo cual no está implementado en esta demo.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleResetData} className="bg-destructive hover:bg-destructive/90">
                                    Entendido
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardContent>
                </Card>
            </main>
        </>
    )
}
    

    
