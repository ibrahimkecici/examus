'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';
import StatusPill from '@/components/StatusPill';
import { apiFetch } from '@/lib/api';

type Batch = { id: string; entityType: string; fileName?: string; status: string; totalRows: number; successRows: number; errorRows: number; createdAt: string };

const SCHEMAS: Record<string, { label: string; columns: { name: string; required?: boolean; note?: string }[] }> = {
  students: {
    label: 'Öğrenci listesi',
    columns: [
      { name: 'studentNo', required: true, note: 'veya "Öğrenci No"' },
      { name: 'fullName', required: true, note: 'veya "Ad Soyad"' },
      { name: 'department', required: true, note: 'veya "Bölüm"' },
      { name: 'courses', note: 'virgülle ayrılmış ders kodları' },
    ],
  },
  courses: {
    label: 'Ders listesi',
    columns: [
      { name: 'code', required: true, note: 'veya "Ders Kodu"' },
      { name: 'name', required: true, note: 'veya "Ders Adı"' },
      { name: 'instructorName', note: 'veya "Öğretim Elemanı"' },
      { name: 'studentCount', note: 'veya "Öğrenci Sayısı"' },
      { name: 'durationMinutes', note: 'veya "Süre" (varsayılan: 120)' },
      { name: 'bookletTypes', note: 'veya "Kitapçıklar" — virgülle: A,B veya A,B,C,D' },
    ],
  },
  classrooms: {
    label: 'Derslik listesi',
    columns: [
      { name: 'code', required: true, note: 'veya "Sınıf Kodu"' },
      { name: 'capacity', required: true, note: 'veya "Kapasite"' },
      { name: 'name', note: 'veya "Sınıf Adı"' },
      { name: 'examCapacity', note: 'sınav kapasitesi (boşsa capacity kullanılır)' },
    ],
  },
  invigilators: {
    label: 'Gözetmen listesi',
    columns: [
      { name: 'staffNo', required: true, note: 'veya "Sicil No"' },
      { name: 'firstName', required: true, note: 'veya "Ad"' },
      { name: 'lastName', required: true, note: 'veya "Soyad"' },
      { name: 'title', note: 'unvan' },
      { name: 'department', note: 'bölüm' },
      { name: 'email' },
      { name: 'maxAssignments', note: 'varsayılan: 4' },
    ],
  },
};

export default function ImportPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Batch[]>('/imports').then((response) => setBatches(response.data)).catch(console.error);
  }, []);

  async function upload(type: string, file?: File) {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    const response = await apiFetch<Batch>(`/imports/${type}`, { method: 'POST', body: form });
    setMessage(`${response.data.fileName} işlendi: ${response.data.successRows} başarılı, ${response.data.errorRows} hatalı.`);
    apiFetch<Batch[]>('/imports').then((r) => setBatches(r.data)).catch(console.error);
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold">Veri Yükleme</h2>
        <p className="text-slate-500">CSV/XLSX dosyalarını doğrulayarak sisteme aktarın.</p>
      </header>

      {message && <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300">{message}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Object.entries(SCHEMAS).map(([key, schema]) => (
          <div key={key} className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between p-5">
              <div>
                <p className="font-semibold">{schema.label}</p>
                <p className="mt-0.5 text-sm text-slate-500">CSV veya XLSX</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === key ? null : key)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {expanded === key ? 'Gizle' : 'Sütunları gör'}
                </button>
                <label className="cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
                  Yükle
                  <input className="hidden" type="file" accept=".csv,.xlsx,.xls" onChange={(e) => upload(key, e.target.files?.[0])} />
                </label>
              </div>
            </div>

            {expanded === key && (
              <div className="border-t border-slate-100 px-5 pb-4 pt-3 dark:border-slate-800">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Beklenen sütunlar</p>
                <table className="w-full text-sm">
                  <tbody>
                    {schema.columns.map((col) => (
                      <tr key={col.name} className="border-t border-slate-50 dark:border-slate-800/60">
                        <td className="py-1.5 pr-3 font-mono text-xs text-blue-600 dark:text-blue-400">{col.name}</td>
                        <td className="py-1.5 pr-2">
                          {col.required && <span className="mr-1 rounded bg-red-50 px-1 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-950 dark:text-red-400">zorunlu</span>}
                        </td>
                        <td className="py-1.5 text-slate-400 text-xs">{col.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      <DataTable
        columns={['Tip', 'Dosya', 'Durum', 'Toplam', 'Başarılı', 'Hatalı']}
        rows={batches.map((batch) => [
          batch.entityType,
          batch.fileName || '-',
          <StatusPill key={batch.id} tone={batch.errorRows ? 'amber' : 'green'}>{batch.status}</StatusPill>,
          batch.totalRows,
          batch.successRows,
          batch.errorRows,
        ])}
      />
    </div>
  );
}
