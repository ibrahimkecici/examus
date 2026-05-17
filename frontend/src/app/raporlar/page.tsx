'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';
import { apiFetch, getApiUrl, getToken } from '@/lib/api';
import { CurrentUser, getStoredUser } from '@/lib/auth';
import { getRoleReportExports } from '@/lib/reportExports';

type Scenario = { id: string; name: string; status: string; score: number; period?: { name: string } };

export default function ReportsPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [user] = useState<CurrentUser | null>(() => getStoredUser());
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
          <ReportLinks key={scenario.id} scenarioId={scenario.id} token={token} user={user} />,
        ])}
      />
    </div>
  );
}

function ReportLinks({ scenarioId, token, user }: { scenarioId: string; token: string | null; user: CurrentUser | null }) {
  const encodedToken = encodeURIComponent(token || '');
  const { pdfExports, excelExports, note } = getRoleReportExports(user);

  return (
    <div className="min-w-[220px] space-y-2">
      {note ? <p className="max-w-[260px] text-xs leading-5 text-slate-500">{note}</p> : null}
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">PDF</p>
        <div className="flex flex-wrap gap-1.5">
          {pdfExports.map((item) => (
            <a key={item.path} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950" href={getApiUrl(`/reports/scenarios/${scenarioId}/${item.path}?token=${encodedToken}`)} title={item.description}>
              {item.label}
            </a>
          ))}
        </div>
      </div>
      {excelExports.length > 0 ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Excel</p>
          <div className="flex flex-wrap gap-1.5">
            {excelExports.map((item) => (
              <a key={item.path} className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950" href={getApiUrl(`/reports/scenarios/${scenarioId}/${item.path}?token=${encodedToken}`)} title={item.description}>
                {item.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
