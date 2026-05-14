'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';
import StatusPill from '@/components/StatusPill';
import { apiFetch } from '@/lib/api';

const imports = [
  { key: 'students', label: 'Öğrenci listesi' },
  { key: 'courses', label: 'Ders listesi' },
  { key: 'classrooms', label: 'Derslik listesi' },
  { key: 'invigilators', label: 'Gözetmen listesi' },
];

type Batch = { id: string; entityType: string; fileName?: string; status: string; totalRows: number; successRows: number; errorRows: number; createdAt: string };

export default function ImportPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [message, setMessage] = useState('');

  async function load() {
    const response = await apiFetch<Batch[]>('/imports');
    setBatches(response.data);
  }

  useEffect(() => {
    apiFetch<Batch[]>('/imports').then((response) => setBatches(response.data)).catch(console.error);
  }, []);

  async function upload(type: string, file?: File) {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    const response = await apiFetch<Batch>(`/imports/${type}`, { method: 'POST', body: form });
    setMessage(`${response.data.fileName} işlendi: ${response.data.successRows} başarılı, ${response.data.errorRows} hatalı.`);
    await load();
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold">Veri Yükleme</h2>
        <p className="text-slate-500">CSV/XLSX dosyalarını doğrulayarak sisteme aktarın.</p>
      </header>
      {message ? <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700">{message}</div> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {imports.map((item) => (
          <label key={item.key} className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="font-semibold">{item.label}</p>
            <p className="mt-1 text-sm text-slate-500">CSV veya XLSX</p>
            <input className="mt-4 text-sm" type="file" accept=".csv,.xlsx,.xls" onChange={(event) => upload(item.key, event.target.files?.[0])} />
          </label>
        ))}
      </div>
      <DataTable
        columns={['Tip', 'Dosya', 'Durum', 'Toplam', 'Başarılı', 'Hatalı']}
        rows={batches.map((batch) => [batch.entityType, batch.fileName || '-', <StatusPill key={batch.id} tone={batch.errorRows ? 'amber' : 'green'}>{batch.status}</StatusPill>, batch.totalRows, batch.successRows, batch.errorRows])}
      />
    </div>
  );
}
