import type { ReactNode } from 'react';
import { SidebarNav } from '@/components/sidebar-nav';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { ExchangeRateReminder } from '@/components/dashboard/exchange-rate-reminder';

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
