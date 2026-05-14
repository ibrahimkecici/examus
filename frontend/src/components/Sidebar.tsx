'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Panel', icon: '▦' },
  { href: '/veri-yukleme', label: 'Veri Yükleme', icon: '⇧' },
  { href: '/ogrenciler', label: 'Öğrenciler', icon: '◎' },
  { href: '/dersler', label: 'Dersler', icon: '□' },
  { href: '/derslikler', label: 'Derslikler', icon: '⌂' },
  { href: '/gozetmenler', label: 'Gözetmenler', icon: '◇' },
  { href: '/donemler', label: 'Dönemler', icon: '◫' },
  { href: '/sinavlar', label: 'Sınavlar', icon: '◷' },
  { href: '/planlama', label: 'Planlama', icon: '⌁' },
  { href: '/raporlar', label: 'Raporlar', icon: '≡' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 h-screen bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300">
      <div className="h-20 flex items-center justify-center border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl font-extrabold text-slate-950 dark:text-white">
          Examus
        </h1>
      </div>

      <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-current text-sm">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-slate-900 dark:bg-white"></div>
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Admin</p>
          <p className="text-xs text-gray-500">Rol bazlı panel</p>
        </div>
      </div>
    </div>
  );
}
