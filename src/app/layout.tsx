import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { FirebaseClientProvider } from '@/firebase';
import { AppLockProvider } from '@/contexts/app-lock-context';
import { AppLock } from '@/components/app-lock';

export const metadata: Metadata = {
  title: 'Mariche Movil',
  description: 'Inventario y POS para Tiendas de Reparación de Móviles',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#FFFFFF" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={cn("font-sans antialiased", process.env.NODE_ENV === 'development' ? 'debug-screens' : '')}>
        <FirebaseClientProvider>
          <AppLockProvider>
            <AppLock />
            {children}
            <Toaster />
          </AppLockProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
