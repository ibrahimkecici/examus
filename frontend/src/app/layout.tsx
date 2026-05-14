import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Examus - Sınav Optimizasyon Paneli',
  description: 'Sınav planlama, yerleşim ve raporlama paneli',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="flex relative">
          <aside className="fixed inset-y-0 left-0 z-50">
            <Sidebar />
          </aside>

          <main className="flex-1 ml-64 p-8 min-h-screen">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
