
"use client";

import { PageHeader } from "@/components/page-header";
import { AnalysisView } from "@/components/analysis/analysis-view";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import type { Product, Sale, RepairJob } from "@/lib/types";
import { collection } from "firebase/firestore";

export default function AnalysisPage() {
    const { firestore } = useFirebase();
    
    const salesCollection = useMemoFirebase(() => 
        firestore ? collection(firestore, "sale_transactions") : null, 
        [firestore]
    );
    const { data: sales, isLoading: salesLoading } = useCollection<Sale>(salesCollection);

    const productsCollection = useMemoFirebase(() => 
        firestore ? collection(firestore, "products") : null,
        [firestore]
    );
    const { data: products, isLoading: productsLoading } = useCollection<Product>(productsCollection);

    const repairJobsCollection = useMemoFirebase(() =>
        firestore ? collection(firestore, "repair_jobs") : null,
        [firestore]
    );
    const { data: repairJobs, isLoading: repairsLoading } = useCollection<RepairJob>(repairJobsCollection);

    return (
        <>
            <PageHeader title="Análisis de Negocio" />
            <main className="flex-1 p-4 sm:p-6">
                <AnalysisView 
                    sales={sales || []} 
                    products={products || []} 
                    repairJobs={repairJobs || []}
                    isLoading={salesLoading || productsLoading || repairsLoading}
                />
            </main>
        </>
    )
}
