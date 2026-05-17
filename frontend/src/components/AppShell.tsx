'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import AccessDenied from '@/components/AccessDenied';
import { apiFetch } from '@/lib/api';
import { canAccessPath, CurrentUser, getStoredUser, setStoredUser } from '@/lib/auth';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(() => getStoredUser());
  const [loaded, setLoaded] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const update = () => {
      setUser(getStoredUser());
      setLoaded(true);
    };
    update();
    window.addEventListener('examus_user_changed', update);
    return () => window.removeEventListener('examus_user_changed', update);
  }, []);

  useEffect(() => {
    if (loaded && !user && pathname !== '/login') {
      router.replace('/login');
    }
  }, [loaded, pathname, router, user]);

  async function completePasswordSetup(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      const response = await apiFetch<CurrentUser>('/auth/complete-password-setup', {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      });
      setStoredUser(response.data);
      setUser(response.data);
      setNewPassword('');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Şifre güncellenemedi.');
    }
  }

  if (pathname === '/login') {
    return <main className="min-h-screen p-8"><div className="mx-auto max-w-7xl">{children}</div></main>;
  }

  if (!loaded || !user) {
    return (
      <main className="min-h-screen p-8">
        <div className="mx-auto max-w-7xl text-sm text-slate-500">Oturum kontrol ediliyor...</div>
      </main>
    );
  }

  if (user?.mustChangePassword) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <form onSubmit={completePasswordSetup} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-2xl font-bold">Yeni şifre belirleyin</h2>
          <p className="mt-2 text-sm text-slate-500">İlk giriş şifreniz geçicidir. Devam etmek için en az 8 karakterli yeni bir şifre belirleyin.</p>
          {message ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">{message}</p> : null}
          <label className="mt-6 block text-sm font-semibold">Yeni Şifre</label>
          <input required minLength={8} type="password" className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          <button className="mt-6 w-full rounded-md bg-blue-600 px-4 py-2 font-semibold text-white">Şifreyi Kaydet</button>
        </form>
      </main>
    );
  }

  const allowed = canAccessPath(user, pathname);

  return (
    <div className="flex relative">
      <aside className="fixed inset-y-0 left-0 z-50">
        <Sidebar />
      </aside>
      <main className="flex-1 ml-64 p-8 min-h-screen">
        <div className="mx-auto max-w-7xl">
          {allowed ? children : <AccessDenied />}
        </div>
      </main>
    </div>
  );
}
