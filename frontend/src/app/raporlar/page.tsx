'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';
import { apiFetch, getApiUrl, getToken } from '@/lib/api';

type Scenario = { id: string; name: string; status: string; score: number; period?: { name: string } };

export default function ReportsPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  useEffect(() => {
    apiFetch<Scenario[]>('/planning/scenarios').then((response) => setScenarios(response.data)).catch(console.error);
  }, []);
  const token = getToken();

  return (
    <div className="space-y-6">
      <header><h2 className="text-3xl font-bold">Raporlama</h2><p className="text-slate-500">Onaylı veya tamamlanmış senaryolardan PDF/Excel çıktıları alın.</p></header>
      <DataTable
        columns={['Senaryo', 'Dönem', 'Durum', 'Skor', 'Çıktılar']}
        rows={scenarios.map((scenario) => [
          scenario.name,
          scenario.period?.name || '-',
          scenario.status,
          Math.round(scenario.score),
          <div key={scenario.id} className="flex flex-wrap gap-2">
            <a className="rounded-md border px-2 py-1 text-sm" href={getApiUrl(`/reports/scenarios/${scenario.id}/calendar.xlsx?token=${encodeURIComponent(token)}`)}>Takvim (Excel)</a>
            <a className="rounded-md border px-2 py-1 text-sm" href={getApiUrl(`/reports/scenarios/${scenario.id}/calendar.pdf?token=${encodeURIComponent(token)}`)}>Takvim (PDF)</a>
            <a className="rounded-md border px-2 py-1 text-sm" href={getApiUrl(`/reports/scenarios/${scenario.id}/invigilators.xlsx?token=${encodeURIComponent(token)}`)}>Gözetmen</a>
            <a className="rounded-md border px-2 py-1 text-sm" href={getApiUrl(`/reports/scenarios/${scenario.id}/students.xlsx?token=${encodeURIComponent(token)}`)}>Öğrenci</a>
            <a className="rounded-md border px-2 py-1 text-sm" href={getApiUrl(`/reports/scenarios/${scenario.id}/classrooms.xlsx?token=${encodeURIComponent(token)}`)}>Derslik</a>
          </div>,
        ])}
      />
    </div>
  );
}
