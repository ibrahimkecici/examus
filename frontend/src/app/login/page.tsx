'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { CurrentUser, setStoredUser } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [emailOrUsername, setEmailOrUsername] = useState('admin@examus.local');
  const [password, setPassword] = useState('Admin123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch<CurrentUser>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ emailOrUsername, password }),
      }) as unknown as { token: string; data: CurrentUser };
      localStorage.setItem('examus_token', response.token);
      setStoredUser(response.data);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş yapılamadı.');
    } finally {
      setLoading(false);
    }
  }

  async function bootstrap() {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch('/auth/bootstrap-admin', {
        method: 'POST',
        body: JSON.stringify({ email: emailOrUsername, password, name: 'Admin' }),
      }) as unknown as { token: string; data: { email: string; password: string } };
      localStorage.setItem('examus_token', response.token);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İlk admin oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
      <form onSubmit={submit} className="w-full rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-2xl font-bold">Examus Giriş</h2>
        <p className="mt-1 text-sm text-slate-500">Rol bazlı yönetim paneline erişin.</p>
        {error ? <div className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
        <label className="mt-6 block text-sm font-semibold">E-posta, öğrenci no veya sicil no</label>
        <input className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={emailOrUsername} onChange={(event) => setEmailOrUsername(event.target.value)} />
        <label className="mt-4 block text-sm font-semibold">Şifre</label>
        <input type="password" className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={password} onChange={(event) => setPassword(event.target.value)} />
        <button disabled={loading} className="mt-6 w-full rounded-md bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-60">
          {loading ? 'Giriş yapılıyor' : 'Giriş Yap'}
        </button>
        <button type="button" disabled={loading} onClick={bootstrap} className="mt-3 w-full rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-60 dark:border-slate-700">
          İlk admin hesabını oluştur
        </button>
      </form>
    </div>
  );
}
