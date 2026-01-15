
import type { ReactNode } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title: string;
  children?: ReactNode;
};

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex flex-1 items-center gap-4 min-w-0">
          <SidebarTrigger />
          <h1 className="truncate text-lg font-semibold md:text-xl">{title}</h1>
        </div>
        
        <div className="flex items-center gap-2">
          {children}
        </div>
      </div>
    </header>
  );
}
