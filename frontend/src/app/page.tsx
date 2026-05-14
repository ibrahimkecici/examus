'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StatusPill from '@/components/StatusPill';
import { apiFetch } from '@/lib/api';

type Dashboard = {
  counts: { students: number; courses: number; classrooms: number; invigilators: number; exams: number };
  warningCount: number;
  scenarios: Array<{ id: string; name: string; status: string; score: number; period?: { name: string } }>;
};

export default function Home() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<Dashboard>('/dashboard')
      .then((response) => setDashboard(response.data))
      .catch((err) => setError(err.message));
  }, []);

  const counts = dashboard?.counts;

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold">Kontrol Paneli</h2>
        <p className="mt-1 text-slate-500">Sınav dönemi, veri kalitesi, planlama ve rapor durumunu izleyin.</p>
      </header>

      {error ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</div> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Metric title="Öğrenci" value={counts?.students} href="/ogrenciler" />
        <Metric title="Ders" value={counts?.courses} href="/dersler" />
        <Metric title="Derslik" value={counts?.classrooms} href="/derslikler" />
        <Metric title="Gözetmen" value={counts?.invigilators} href="/gozetmenler" />
        <Metric title="Sınav" value={counts?.exams} href="/sinavlar" />
      </div>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Son Planlama Senaryoları</h3>
            <Link className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white" href="/planlama">
              Planlama
            </Link>
          </div>
          <div className="space-y-3">
            {dashboard?.scenarios?.length ? (
              dashboard.scenarios.map((scenario) => (
                <Link key={scenario.id} href={`/planlama?scenario=${scenario.id}`} className="flex items-center justify-between rounded-lg border border-slate-100 p-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950">
                  <div>
                    <p className="font-semibold">{scenario.name}</p>
                    <p className="text-sm text-slate-500">{scenario.period?.name || 'Dönem atanmamış'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill tone={scenario.status === 'APPROVED' ? 'green' : 'blue'}>{scenario.status}</StatusPill>
                    <span className="font-mono text-sm">{Math.round(scenario.score)}</span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="rounded-lg bg-slate-50 p-6 text-center text-slate-500 dark:bg-slate-950">Henüz senaryo yok.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-lg font-semibold">Plan Sağlığı</h3>
          <div className="mt-6 text-5xl font-bold">{dashboard?.warningCount ?? 0}</div>
          <p className="mt-2 text-sm text-slate-500">Son senaryolardaki toplam uyarı sayısı</p>
          <Link href="/raporlar" className="mt-6 inline-flex rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-950">
            Raporları aç
          </Link>
        </div>
      </section>
    </div>
  );
}

function Metric({ title, value, href }: { title: string; value?: number; href: string }) {
  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white p-5 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-950">
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-bold">{value ?? '-'}</p>
    </Link>
  );
}
