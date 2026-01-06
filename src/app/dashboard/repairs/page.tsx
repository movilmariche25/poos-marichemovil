"use client";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PlusCircle } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { columns } from "@/components/repairs/columns";
import { RepairFormDialog } from "@/components/repairs/repair-form-dialog";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import type { RepairJob } from "@/lib/types";

export default function RepairsPage() {
    const { firestore } = useFirebase();
    const repairJobsCollection = useMemoFirebase(() =>
        firestore ? collection(firestore, 'repair_jobs') : null,
        [firestore]
    );
    const { data: repairJobs, isLoading } = useCollection<RepairJob>(repairJobsCollection);

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
                    data={repairJobs || []}
                    isLoading={isLoading}
                    filterColumnId="customerName"
                    filterPlaceholder="Filtrar por nombre de cliente..."
                />
            </main>
        </>
    )
}
