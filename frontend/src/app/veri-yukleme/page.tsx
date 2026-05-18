'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import StatusPill from '@/components/StatusPill';
import { apiFetch } from '@/lib/api';
import { CurrentUser, getStoredUser } from '@/lib/auth';

type Batch = { id: string; entityType: string; fileName?: string; status: string; totalRows: number; successRows: number; errorRows: number; createdRows?: number; updatedRows?: number; createdUserAccounts?: number; createdAt: string };
type ImportError = { row: number; field?: string; message: string };
type ImportPreview = {
  entityType: string;
  fileName: string;
  totalRows: number;
  columns: string[];
  missingColumns: string[];
  unknownColumns: string[];
  validRows: number;
  errorRows: number;
  creatableRows: number;
  updateRows: number;
  createdUserAccounts: number;
  departments: Array<{ id?: string | null; code: string; name: string; willCreate?: boolean }>;
  rowErrors: ImportError[];
  departmentLockedToUser: boolean;
};

const SCHEMAS: Record<string, { label: string; columns: { name: string; required?: boolean; note?: string }[] }> = {
  students: {
    label: 'Öğrenci listesi',
    columns: [
      { name: 'studentNo', required: true, note: 'veya "Öğrenci No"' },
      { name: 'fullName', required: true, note: 'veya "Ad Soyad"' },
      { name: 'department', required: true, note: 'Department kaydıyla eşleşir; admin yoksa oluşturur, koordinatörde kendi bölümü kullanılır' },
      { name: 'courses', note: 'virgülle ayrılmış ders kodları' },
    ],
  },
  courses: {
    label: 'Ders listesi',
    columns: [
      { name: 'code', required: true, note: 'veya "Ders Kodu"' },
      { name: 'name', required: true, note: 'veya "Ders Adı"' },
      { name: 'instructorName', note: 'veya "Öğretim Elemanı"' },
      { name: 'department', note: 'Department kaydıyla eşleşir; koordinatörde kendi bölümü kullanılır' },
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
      { name: 'department', note: 'Department kaydıyla eşleşir; koordinatörde kendi bölümü kullanılır' },
      { name: 'email' },
      { name: 'maxAssignments', note: 'varsayılan: 4' },
      { name: 'account', note: 'otomatik oluşur: kullanıcı adı sicil no, ilk şifre 12345678' },
    ],
  },
};

export default function ImportPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [errorBatch, setErrorBatch] = useState<{ id: string; fileName?: string; errors: ImportError[] } | null>(null);
  const [preview, setPreview] = useState<{ type: string; file: File; data: ImportPreview } | null>(null);
  const [user] = useState<CurrentUser | null>(() => getStoredUser());

  useEffect(() => {
    apiFetch<Batch[]>('/imports').then((response) => setBatches(response.data)).catch(console.error);
  }, []);

  async function showErrors(batch: Batch) {
    const response = await apiFetch<ImportError[]>(`/imports/${batch.id}/errors`);
    setErrorBatch({ id: batch.id, fileName: batch.fileName, errors: response.data });
  }

  async function upload(type: string, file?: File) {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    const response = await apiFetch<Batch>(`/imports/${type}`, { method: 'POST', body: form });
    setMessage(`${response.data.fileName} işlendi: ${response.data.successRows} başarılı, ${response.data.errorRows} hatalı, ${response.data.createdRows ?? 0} yeni, ${response.data.updatedRows ?? 0} güncelleme, ${response.data.createdUserAccounts ?? 0} hesap.`);
    setPreview(null);
    apiFetch<Batch[]>('/imports').then((r) => setBatches(r.data)).catch(console.error);
  }

  async function previewFile(type: string, file?: File) {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    const response = await apiFetch<ImportPreview>(`/imports/${type}/preview`, { method: 'POST', body: form });
    setPreview({ type, file, data: response.data });
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold">Veri Yükleme</h2>
        <p className="text-slate-500">CSV/XLSX dosyalarını doğrulayarak sisteme aktarın.</p>
      </header>

      {message && <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300">{message}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Object.entries(SCHEMAS).filter(([key]) => user?.role === 'ADMIN' || key !== 'classrooms').map(([key, schema]) => (
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
                <a
                  href={templateHref(key)}
                  download={`examus-${key}-template.csv`}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-950"
                >
                  Şablon
                </a>
                <label className="cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
                  Önizle
                  <input className="hidden" type="file" accept=".csv,.xlsx,.xls" onChange={(e) => previewFile(key, e.target.files?.[0])} />
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
        columns={['Tip', 'Dosya', 'Durum', 'Toplam', 'Başarılı', 'Hatalı', 'Özet', '']}
        rows={batches.map((batch) => [
          batch.entityType,
          batch.fileName || '-',
          <StatusPill key={batch.id} tone={batch.errorRows ? 'amber' : 'green'}>{batch.status}</StatusPill>,
          batch.totalRows,
          batch.successRows,
          batch.errorRows,
          `${batch.createdRows ?? '-'} yeni / ${batch.updatedRows ?? '-'} günc. / ${batch.createdUserAccounts ?? '-'} hesap`,
          batch.errorRows > 0
            ? <button key={`err-${batch.id}`} onClick={() => showErrors(batch)} className="rounded border px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950">Hataları Gör</button>
            : null,
        ])}
      />

      {preview && (
        <Modal title={`Import Önizleme — ${preview.data.fileName}`} onClose={() => setPreview(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <PreviewStat label="Toplam" value={preview.data.totalRows} />
              <PreviewStat label="Geçerli" value={preview.data.validRows} />
              <PreviewStat label="Hatalı" value={preview.data.errorRows} />
              <PreviewStat label="Yeni" value={preview.data.creatableRows} />
              <PreviewStat label="Hesap" value={preview.data.createdUserAccounts} />
            </div>
            {preview.data.departmentLockedToUser ? (
              <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                Bölüm koordinatörü importu kendi bölüm kapsamına sabitlenir.
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <PreviewList title="Eksik kolonlar" items={preview.data.missingColumns} tone="red" />
              <PreviewList title="Tanınmayan kolonlar" items={preview.data.unknownColumns} tone="amber" />
              <PreviewList title="Department eşleşmeleri" items={preview.data.departments.map((department) => `${department.code} - ${department.name}${department.willCreate ? ' (oluşacak)' : ''}`)} tone="slate" />
              <PreviewList title="Okunan kolonlar" items={preview.data.columns} tone="slate" />
            </div>
            {preview.data.rowErrors.length > 0 ? (
              <div className="overflow-x-auto">
                <p className="mb-2 text-sm font-semibold">Satır hataları</p>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950">
                    <tr><th className="px-3 py-2 text-left">Satır</th><th className="px-3 py-2 text-left">Alan</th><th className="px-3 py-2 text-left">Hata</th></tr>
                  </thead>
                  <tbody>
                    {preview.data.rowErrors.map((err, index) => (
                      <tr key={index} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2">{err.row}</td>
                        <td className="px-3 py-2 font-mono text-xs">{err.field || '-'}</td>
                        <td className="px-3 py-2 text-red-600">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPreview(null)} className="rounded-md border px-4 py-2 text-sm dark:border-slate-700">İptal</button>
              <button
                type="button"
                onClick={() => upload(preview.type, preview.file)}
                disabled={preview.data.missingColumns.length > 0 || preview.data.errorRows > 0}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Importu Başlat
              </button>
            </div>
          </div>
        </Modal>
      )}

      {errorBatch && (
        <Modal title={`Hata Detayları — ${errorBatch.fileName || errorBatch.id}`} onClose={() => setErrorBatch(null)}>
          {errorBatch.errors.length === 0 ? (
            <p className="text-sm text-slate-500">Hata kaydı bulunamadı.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Satır</th>
                    <th className="px-3 py-2 text-left">Alan</th>
                    <th className="px-3 py-2 text-left">Hata</th>
                  </tr>
                </thead>
                <tbody>
                  {errorBatch.errors.map((err, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2 tabular-nums">{err.row}</td>
                      <td className="px-3 py-2 font-mono text-xs text-blue-600">{err.field || '-'}</td>
                      <td className="px-3 py-2 text-red-600 dark:text-red-400">{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function templateHref(type: string) {
  const headers = SCHEMAS[type]?.columns.map((column) => column.name) || [];
  const example: Record<string, string> = {
    studentNo: '20240001',
    fullName: 'Ayşe Yılmaz',
    department: 'Bilgisayar Mühendisliği',
    courses: 'BLM101,BLM103',
    code: type === 'classrooms' ? 'A101' : 'BLM101',
    name: type === 'classrooms' ? 'A Blok 101' : 'Programlama I',
    instructorName: 'Dr. Öğr. Üyesi Mehmet Demir',
    studentCount: '60',
    durationMinutes: '120',
    bookletTypes: 'A,B',
    capacity: '90',
    examCapacity: '45',
    staffNo: 'GZ001',
    firstName: 'Zeynep',
    lastName: 'Kaya',
    title: 'Arş. Gör.',
    email: 'zeynep.kaya@example.edu',
    maxAssignments: '4',
    account: 'otomatik',
  };
  const rows = [headers.join(','), headers.map((header) => example[header] || '').join(',')].join('\n');
  return `data:text/csv;charset=utf-8,${encodeURIComponent(rows)}`;
}

function PreviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-950">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}

function PreviewList({ title, items, tone }: { title: string; items: string[]; tone: 'red' | 'amber' | 'slate' }) {
  const toneClass = tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : 'text-slate-600 dark:text-slate-300';
  return (
    <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {items.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => <span key={item} className={`rounded bg-slate-50 px-2 py-1 text-xs dark:bg-slate-950 ${toneClass}`}>{item}</span>)}
        </div>
      ) : <p className="text-sm text-slate-400">Yok</p>}
    </div>
  );
}
