import type { ReactNode } from 'react';
import { SidebarNav } from '@/components/sidebar-nav';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const ExchangeRateReminder = dynamic(
    () => import('@/components/dashboard/exchange-rate-reminder').then(mod => mod.ExchangeRateReminder),
    { 
        ssr: false,
        loading: () => (
             <div className="p-4 border-b">
                <Skeleton className="h-24 w-full" />
            </div>
        )
    }
);


export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <SidebarNav />
      <SidebarInset>
          <ExchangeRateReminder />
          {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
