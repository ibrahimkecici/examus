'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';
import StatusPill from '@/components/StatusPill';
import { apiFetch } from '@/lib/api';

type Period = { id: string; name: string };
type Scenario = { id: string; name: string; strategy: string; status: string; score: number; metrics?: Record<string, unknown>; warnings?: Array<{ message: string }>; period?: Period };

export default function PlanningPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [form, setForm] = useState({ periodId: '', name: '', strategy: 'efficient' });
  const [selected, setSelected] = useState<Scenario | null>(null);

  async function load() {
    const [periodResponse, scenarioResponse] = await Promise.all([apiFetch<Period[]>('/exam-periods'), apiFetch<Scenario[]>('/planning/scenarios')]);
    setPeriods(periodResponse.data);
    setScenarios(scenarioResponse.data);
  }

  useEffect(() => {
    Promise.all([apiFetch<Period[]>('/exam-periods'), apiFetch<Scenario[]>('/planning/scenarios')])
      .then(([periodResponse, scenarioResponse]) => {
        setPeriods(periodResponse.data);
        setScenarios(scenarioResponse.data);
      })
      .catch(console.error);
  }, []);

  async function createScenario(event: React.FormEvent) {
    event.preventDefault();
    await apiFetch('/planning/scenarios', { method: 'POST', body: JSON.stringify(form) });
    setForm({ periodId: '', name: '', strategy: 'efficient' });
    await load();
  }

  async function run(id: string) {
    const response = await apiFetch<Scenario>(`/planning/scenarios/${id}/run`, { method: 'POST' });
    setSelected(response.data);
    await load();
  }

  async function approve(id: string) {
    await apiFetch(`/planning/scenarios/${id}/approve`, { method: 'POST' });
    await load();
  }

  async function insight(id: string) {
    await apiFetch(`/ai/scenarios/${id}/insights`, { method: 'POST' });
    const response = await apiFetch<Scenario>(`/planning/scenarios/${id}`);
    setSelected(response.data);
  }

  return (
    <div className="space-y-6">
      <header><h2 className="text-3xl font-bold">Otomatik Planlama</h2><p className="text-slate-500">Senaryo üret, çalıştır, karşılaştır ve onayla.</p></header>
      <form onSubmit={createScenario} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-4">
        <select required className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={form.periodId} onChange={(e) => setForm({ ...form, periodId: e.target.value })}>
          <option value="">Dönem seçin</option>
          {periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
        </select>
        <input required placeholder="Senaryo adı" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value })}>
          <option value="efficient">Verimli</option>
          <option value="compact">Kompakt</option>
          <option value="balanced">Dengeli</option>
          <option value="minimum_rooms">Minimum Derslik</option>
          <option value="fair_invigilator">Adil Gözetmen</option>
          <option value="student_friendly">Öğrenci Dostu</option>
        </select>
        <button className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white">Senaryo Oluştur</button>
      </form>
      <DataTable
        columns={['Ad', 'Dönem', 'Strateji', 'Durum', 'Skor', 'Aksiyon']}
        rows={scenarios.map((scenario) => [
          scenario.name,
          scenario.period?.name || '-',
          scenario.strategy,
          <StatusPill key={scenario.id} tone={scenario.status === 'APPROVED' ? 'green' : scenario.status === 'COMPLETED' ? 'blue' : 'slate'}>{scenario.status}</StatusPill>,
          Math.round(scenario.score),
          <div key={scenario.id} className="flex flex-wrap gap-2">
            <button onClick={() => run(scenario.id)} className="rounded-md border px-2 py-1 text-sm">Çalıştır</button>
            <button onClick={() => insight(scenario.id)} className="rounded-md border px-2 py-1 text-sm">AI</button>
            <button onClick={() => approve(scenario.id)} className="rounded-md border px-2 py-1 text-sm">Onayla</button>
          </div>,
        ])}
      />
      {selected ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold">{selected.name} özeti</h3>
          <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify({ metrics: selected.metrics, warnings: selected.warnings }, null, 2)}</pre>
        </section>
      ) : null}
    </div>
  );
}
