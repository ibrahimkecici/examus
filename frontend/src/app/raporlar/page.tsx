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
          <ReportLinks key={scenario.id} scenarioId={scenario.id} token={token} />,
        ])}
      />
    </div>
  );
}

function ReportLinks({ scenarioId, token }: { scenarioId: string; token: string | null }) {
  const encodedToken = encodeURIComponent(token || '');
  const pdfLinks = [
    ['Kapsamlı', 'full.pdf'],
    ['Takvim', 'calendar.pdf'],
    ['Salon', 'classrooms.pdf'],
    ['Gözetmen', 'invigilators.pdf'],
    ['Öğrenci/Oturma', 'students.pdf'],
  ];
  const excelLinks = [
    ['Takvim', 'calendar.xlsx'],
    ['Gözetmen', 'invigilators.xlsx'],
    ['Öğrenci', 'students.xlsx'],
    ['Derslik', 'classrooms.xlsx'],
  ];

  return (
    <div className="min-w-[280px] space-y-2">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">PDF</p>
        <div className="flex flex-wrap gap-1.5">
          {pdfLinks.map(([label, path]) => (
            <a key={path} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950" href={getApiUrl(`/reports/scenarios/${scenarioId}/${path}?token=${encodedToken}`)}>
              {label}
            </a>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Excel</p>
        <div className="flex flex-wrap gap-1.5">
          {excelLinks.map(([label, path]) => (
            <a key={path} className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950" href={getApiUrl(`/reports/scenarios/${scenarioId}/${path}?token=${encodedToken}`)}>
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
