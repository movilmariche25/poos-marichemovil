
"use client";

import { useState, useMemo } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PlusCircle, CalendarIcon, X as ClearIcon } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { columns } from "@/components/repairs/columns";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy }from "firebase/firestore";
import type { RepairJob } from "@/lib/types";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { RepairFormDialog } from "@/components/repairs/repair-form-dialog";


export default function RepairsPage() {
    const { firestore } = useFirebase();
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

    const repairJobsQuery = useMemoFirebase(() =>
        firestore 
            ? query(collection(firestore, 'repair_jobs'), orderBy('createdAt', 'desc')) 
            : null,
        [firestore]
    );
    const { data: repairJobs, isLoading } = useCollection<RepairJob>(repairJobsQuery);

    const filteredRepairJobs = useMemo(() => {
        if (!repairJobs) return [];
        if (!dateRange?.from) return repairJobs;

        const from = startOfDay(dateRange.from);
        const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);

        return repairJobs.filter(job => {
            if (!job.createdAt) return false;
            const jobDate = new Date(job.createdAt);
            return isWithinInterval(jobDate, { start: from, end: to });
        });
    }, [repairJobs, dateRange]);

    return (
        <>
            <PageHeader title="Trabajos de Reparación">
                <RepairFormDialog>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Registrar Nueva Reparación
                    </Button>
                </RepairFormDialog>
            </PageHeader>
            <main className="flex-1 p-4 sm:p-6">
                <DataTable 
                    columns={columns} 
                    data={filteredRepairJobs || []}
                    isLoading={isLoading}
                    filterPlaceholder="Buscar por cliente, teléfono, ID, dispositivo, IMEI..."
                    globalFilterFn={(row, columnId, filterValue) => {
                        const job = row.original;
                        const searchTerm = filterValue.toLowerCase();
                        
                        const nameMatch = job.customerName.toLowerCase().includes(searchTerm);
                        const phoneMatch = job.customerPhone.toLowerCase().includes(searchTerm);
                        const idMatch = job.id?.toLowerCase().includes(searchTerm);
                        const deviceMatch = `${job.deviceMake} ${job.deviceModel}`.toLowerCase().includes(searchTerm);
                        const imeiMatch = job.deviceImei?.toLowerCase().includes(searchTerm);

                        return nameMatch || phoneMatch || idMatch || deviceMatch || imeiMatch;
                    }}
                >
                    {(table) => (
                        <div className="flex items-center gap-2">
                             <Popover>
                                <PopoverTrigger asChild>
                                <Button
                                    id="date"
                                    variant={"outline"}
                                    className={cn(
                                    "w-[300px] justify-start text-left font-normal",
                                    !dateRange && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                    dateRange.to ? (
                                        <>
                                        {format(dateRange.from, "LLL dd, y", { locale: es })} -{" "}
                                        {format(dateRange.to, "LLL dd, y", { locale: es })}
                                        </>
                                    ) : (
                                        format(dateRange.from, "LLL dd, y", { locale: es })
                                    )
                                    ) : (
                                    <span>Filtrar por fecha...</span>
                                    )}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    numberOfMonths={2}
                                    locale={es}
                                />
                                </PopoverContent>
                            </Popover>
                            {dateRange && (
                                <Button variant="ghost" onClick={() => setDateRange(undefined)}>
                                    <ClearIcon className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    )}
                </DataTable>
            </main>
        </>
    )
}
