'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';
import { apiFetch, formatDate } from '@/lib/api';

type Period = { id: string; name: string; startDate: string; endDate: string; status: string; exams: unknown[]; scenarios: unknown[] };

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });

  async function load() {
    const response = await apiFetch<Period[]>('/exam-periods');
    setPeriods(response.data);
  }
  useEffect(() => {
    apiFetch<Period[]>('/exam-periods').then((response) => setPeriods(response.data)).catch(console.error);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await apiFetch('/exam-periods', {
      method: 'POST',
      body: JSON.stringify({ ...form, slots: [{ startTime: '09:00', endTime: '11:00' }, { startTime: '12:00', endTime: '14:00' }, { startTime: '15:00', endTime: '17:00' }] }),
    });
    setForm({ name: '', startDate: '', endDate: '' });
    await load();
  }

  return (
    <div className="space-y-6">
      <header><h2 className="text-3xl font-bold">Sınav Dönemleri</h2><p className="text-slate-500">Tarih aralığı ve günlük slot tanımları.</p></header>
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-4">
        <input required placeholder="Dönem adı" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input required type="date" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        <input required type="date" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        <button className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white">Dönem Oluştur</button>
      </form>
      <DataTable columns={['Ad', 'Başlangıç', 'Bitiş', 'Durum', 'Sınav', 'Senaryo']} rows={periods.map((period) => [period.name, formatDate(period.startDate), formatDate(period.endDate), period.status, period.exams.length, period.scenarios.length])} />
    </div>
  );
}
