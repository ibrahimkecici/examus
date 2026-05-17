'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import { apiFetch } from '@/lib/api';
import { CurrentUser, getStoredUser, ROLE_LABELS } from '@/lib/auth';

const navItems = [
  { href: '/', label: 'Panel', icon: '▦', roles: ['ADMIN', 'DEPARTMENT_MANAGER', 'INSTRUCTOR', 'INVIGILATOR', 'STUDENT'] },
  { href: '/veri-yukleme', label: 'Veri Yükleme', icon: '⇧', roles: ['ADMIN'] },
  { href: '/ogrenciler', label: 'Öğrenciler', icon: '◎', roles: ['ADMIN', 'DEPARTMENT_MANAGER', 'INSTRUCTOR', 'STUDENT'] },
  { href: '/dersler', label: 'Dersler', icon: '□', roles: ['ADMIN', 'DEPARTMENT_MANAGER', 'INSTRUCTOR', 'STUDENT'] },
  { href: '/derslikler', label: 'Derslikler', icon: '⌂', roles: ['ADMIN', 'DEPARTMENT_MANAGER', 'INSTRUCTOR'] },
  { href: '/bolumler', label: 'Bölümler', icon: '◇', roles: ['ADMIN'] },
  { href: '/gozetmenler', label: 'Gözetmenler', icon: '◇', roles: ['ADMIN', 'DEPARTMENT_MANAGER', 'INVIGILATOR'] },
  { href: '/donemler', label: 'Dönemler', icon: '◫', roles: ['ADMIN', 'DEPARTMENT_MANAGER', 'INSTRUCTOR'] },
  { href: '/sinavlar', label: 'Sınavlar', icon: '◷', roles: ['ADMIN', 'DEPARTMENT_MANAGER', 'INSTRUCTOR', 'STUDENT'] },
  { href: '/planlama', label: 'Planlama', icon: '⌁', roles: ['ADMIN', 'DEPARTMENT_MANAGER'] },
  { href: '/raporlar', label: 'Raporlar', icon: '≡', roles: ['ADMIN', 'DEPARTMENT_MANAGER', 'INSTRUCTOR', 'INVIGILATOR', 'STUDENT'] },
  { href: '/kullanicilar', label: 'Kullanıcılar', icon: '⊙', roles: ['ADMIN'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const update = () => setUser(getStoredUser());
    update();
    window.addEventListener('examus_user_changed', update);
    return () => window.removeEventListener('examus_user_changed', update);
  }, []);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg('');
    try {
      await apiFetch('/auth/change-password', { method: 'POST', body: JSON.stringify(pwForm) });
      setPwMsg('Şifre başarıyla değiştirildi.');
      setPwForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      setPwMsg(err instanceof Error ? err.message : 'Hata oluştu.');
    }
  }

  const inputCls = 'rounded-md border px-3 py-2 text-sm w-full dark:border-slate-700 dark:bg-slate-950';

  return (
    <div className="w-64 h-screen bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300">
      <div className="h-20 flex items-center justify-center border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl font-extrabold text-slate-950 dark:text-white">
          Examus
        </h1>
      </div>

      <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
        {navItems.filter((item) => !user || item.roles.includes(user.role)).map((item) => {
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

      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 dark:bg-white shrink-0"></div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">{user?.name || 'Kullanıcı'}</p>
            {user?.role ? <p className="truncate text-xs text-slate-500">{ROLE_LABELS[user.role]}</p> : null}
            <button onClick={() => { setPwMsg(''); setPwOpen(true); }} className="text-xs text-blue-500 hover:underline">
              Şifre Değiştir
            </button>
          </div>
        </div>
      </div>

      {pwOpen && (
        <Modal title="Şifre Değiştir" onClose={() => setPwOpen(false)}>
          <form onSubmit={changePassword} className="space-y-3">
            {pwMsg && (
              <p className={`rounded-md p-2 text-sm ${pwMsg.includes('başarıyla') ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'}`}>{pwMsg}</p>
            )}
            <div>
              <label className="mb-1 block text-xs text-slate-500">Mevcut Şifre</label>
              <input required type="password" className={inputCls} value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Yeni Şifre</label>
              <input required type="password" className={inputCls} value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setPwOpen(false)} className="rounded-md border px-4 py-2 text-sm dark:border-slate-700">Kapat</button>
              <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Değiştir</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
