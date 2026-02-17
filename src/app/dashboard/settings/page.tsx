
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
import { Switch } from "@/components/ui/switch";

const settingsSchema = z.object({
    bcvRate: z.coerce.number().positive("La tasa BCV debe ser un número positivo."),
    parallelRate: z.coerce.number().positive("La tasa de reposición debe ser un número positivo."),
    profitMargin: z.coerce.number().min(0, "El margen de ganancia no puede ser negativo."),
    autoUpdateBcv: z.boolean().default(false),
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
            autoUpdateBcv: false,
        }
    });

    useEffect(() => {
        if (settings) {
            form.reset({
                bcvRate: settings.bcvRate,
                parallelRate: settings.parallelRate,
                profitMargin: settings.profitMargin,
                autoUpdateBcv: settings.autoUpdateBcv || false,
                lastUpdated: settings.lastUpdated
            });
        }
    }, [settings, form]);


    const handleSettingsSave = (values: SettingsFormData) => {
        if (!settingsRef) return;
        const updatedValues = {
            ...settings,
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
            const response = await fetch('https://ve.dolarapi.com/v1/dolares/bcv');
            if (!response.ok) {
                throw new Error(`Error de red: ${response.statusText}`);
            }
            const data = await response.json();
            
            if (data && data.promedio) {
                form.setValue('bcvRate', data.promedio, { shouldValidate: true });
                toast({
                    title: "Tasa BCV Obtenida",
                    description: `Nuevo valor de la API: ${data.promedio}. Guarda los cambios para aplicar al sistema.`,
                });
            } else {
                 throw new Error("Formato de respuesta de API inesperado.");
            }
        } catch (error) {
            console.error("Error al obtener la tasa BCV:", error);
            toast({
                variant: "destructive",
                title: "Error al Consultar API",
                description: "No se pudo obtener la tasa desde DolarApi. Revisa tu conexión.",
            });
        } finally {
            setIsFetchingRate(false);
        }
    };


    const handleResetData = () => {
        toast({
            variant: "destructive",
            title: "Acción no permitida",
            description: "El reseteo total de datos debe configurarse por un administrador del servidor.",
        });
    }

    return (
        <>
            <PageHeader title="Configuración" />
            <main className="flex-1 p-4 sm:p-6 space-y-6">
                <Card className="max-w-2xl shadow-md">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSettingsSave)}>
                            <CardHeader>
                                <CardTitle>Tasas de Cambio y Precios</CardTitle>
                                <CardDescription>
                                    Configura las tasas de cambio y el margen de ganancia para el cálculo automático de precios.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {isLoading ? <p className="animate-pulse">Cargando configuración...</p> :
                                <>
                                <FormField
                                    control={form.control}
                                    name="autoUpdateBcv"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-muted/30">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-base">Actualizar BCV automáticamente</FormLabel>
                                                <FormDescription>
                                                    Sincroniza la tasa oficial BCV cada 4 horas usando DolarApi.com.
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="bcvRate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Tasa Oficial (BCV) - Actual en Sistema</FormLabel>
                                            <div className="flex items-center gap-2">
                                                <FormControl>
                                                    <Input type="number" step="0.01" placeholder="Ej: 36.50" {...field} className="text-lg font-mono" />
                                                </FormControl>
                                                <Button type="button" variant="outline" size="icon" onClick={handleUpdateBcvRate} disabled={isFetchingRate} title="Consultar API ahora">
                                                    {isFetchingRate ? <Loader2 className="animate-spin h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                            <FormDescription>La tasa utilizada para convertir precios de $ a Bolívares en el punto de venta.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="parallelRate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Tasa de Reposición (Manual / Paralelo)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" placeholder="Ej: 40.00" {...field} className="text-lg font-mono" />
                                                </FormControl>
                                            <FormDescription>La tasa real para calcular cuánto te cuesta reponer la mercancía (siempre manual).</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="profitMargin"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Margen de Ganancia Global (%)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="1" placeholder="Ej: 100" {...field} className="text-lg font-mono" />
                                                </FormControl>
                                            <FormDescription>El porcentaje de ganancia sobre el costo real si no hay margen individual definido.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                </>}
                            </CardContent>
                            <CardFooter className="border-t px-6 py-4">
                                <Button type="submit" disabled={form.formState.isSubmitting || isLoading} className="w-full sm:w-auto">
                                    {form.formState.isSubmitting ? <Loader2 className="animate-spin mr-2" /> : null}
                                    Guardar Configuración
                                </Button>
                            </CardFooter>
                        </form>
                    </Form>
                </Card>

                <Card className="max-w-2xl border-destructive/20">
                    <CardHeader>
                        <CardTitle className="text-destructive">Zona de Peligro</CardTitle>
                        <CardDescription>
                            Estas acciones son definitivas y podrían afectar seriamente la integridad de tu negocio.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Restablecer Todo el Sistema
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta acción es irreversible. Se eliminarían productos, ventas y reparaciones. Actualmente esta función está deshabilitada por seguridad.
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
