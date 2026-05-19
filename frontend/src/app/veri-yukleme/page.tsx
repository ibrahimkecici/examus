'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import StatusPill from '@/components/StatusPill';
import { apiFetch, getApiUrl, getToken } from '@/lib/api';
import { CurrentUser, getStoredUser } from '@/lib/auth';

const CREATE_INSTRUCTOR_MAPPING = '__create__';

type Batch = { id: string; entityType: string; fileName?: string; status: string; totalRows: number; successRows: number; errorRows: number; createdRows?: number; updatedRows?: number; createdUserAccounts?: number; createdAt: string };
type ImportError = { row: number; field?: string; message: string };
type InstructorOption = { id: string; name: string; email: string; departmentId?: string | null };
type InstructorPreview = {
  row: number;
  courseCode: string;
  instructorName?: string;
  source: string;
  value?: string;
  status: 'matched' | 'unmatched' | 'ambiguous' | 'missing';
  user?: InstructorOption | null;
  matches?: InstructorOption[];
  existingInstructorId?: string | null;
};
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
  instructorMatches?: InstructorPreview[];
  unmatchedInstructors?: InstructorPreview[];
  requiresInstructorMapping?: boolean;
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
      { name: 'instructorEmail', note: 'INSTRUCTOR kullanıcısının e-postası' },
      { name: 'instructorStaffNo', note: 'varsa personel/sicil no; kullanıcı e-postası ile eşleştirilir' },
      { name: 'instructorName', note: 'sadece eşleştirme yardımı; bulunamazsa manuel seçim gerekir' },
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
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [instructorMappings, setInstructorMappings] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<{ type: string; action: 'preview' | 'upload' } | null>(null);
  const [user] = useState<CurrentUser | null>(() => getStoredUser());

  useEffect(() => {
    apiFetch<Batch[]>('/imports').then((response) => setBatches(response.data)).catch(console.error);
    if (user?.role === 'ADMIN' || user?.role === 'DEPARTMENT_MANAGER') {
      apiFetch<InstructorOption[]>('/users?role=INSTRUCTOR').then((response) => setInstructors(response.data)).catch(console.error);
    }
  }, [user?.role]);

  async function showErrors(batch: Batch) {
    const response = await apiFetch<ImportError[]>(`/imports/${batch.id}/errors`);
    setErrorBatch({ id: batch.id, fileName: batch.fileName, errors: response.data });
  }

  async function upload(type: string, file?: File) {
    if (!file) return;
    setBusy({ type, action: 'upload' });
    try {
      const form = new FormData();
      form.append('file', file);
      if (type === 'courses') {
        form.append('instructorMappings', JSON.stringify(instructorMappings));
      }
      const response = await apiFetch<Batch>(`/imports/${type}`, { method: 'POST', body: form });
      setMessage(`${response.data.fileName} işlendi: ${response.data.successRows} başarılı, ${response.data.errorRows} hatalı, ${response.data.createdRows ?? 0} yeni, ${response.data.updatedRows ?? 0} güncelleme, ${response.data.createdUserAccounts ?? 0} hesap.`);
      setPreview(null);
      setInstructorMappings({});
      apiFetch<Batch[]>('/imports').then((r) => setBatches(r.data)).catch(console.error);
    } finally {
      setBusy(null);
    }
  }

  async function previewFile(type: string, file?: File) {
    if (!file) return;
    setBusy({ type, action: 'preview' });
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await apiFetch<ImportPreview>(`/imports/${type}/preview`, { method: 'POST', body: form });
      const mappings: Record<string, string> = {};
      for (const item of response.data.instructorMatches || []) {
        if (item.courseCode && item.user?.id) mappings[item.courseCode] = item.user.id;
      }
      for (const item of response.data.unmatchedInstructors || []) {
        if (item.courseCode && item.existingInstructorId) mappings[item.courseCode] = item.existingInstructorId;
        else if (item.courseCode) mappings[item.courseCode] = CREATE_INSTRUCTOR_MAPPING;
      }
      setInstructorMappings(mappings);
      setPreview({ type, file, data: response.data });
    } finally {
      setBusy(null);
    }
  }

  const missingInstructorMappings = preview?.type === 'courses'
    ? (preview.data.unmatchedInstructors || []).filter((item) => !item.existingInstructorId && !instructorMappings[item.courseCode])
    : [];
  const previewHasHardErrors = Boolean(preview && (preview.data.missingColumns.length > 0 || preview.data.errorRows > 0 || missingInstructorMappings.length > 0));

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
                  href={templateUrl(key)}
                  download={`examus-${key}-template.xlsx`}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-950"
                >
                  XLSX Şablon
                </a>
                <label className={`rounded-md px-3 py-1.5 text-sm font-semibold text-white ${busy ? 'cursor-not-allowed bg-slate-400' : 'cursor-pointer bg-blue-600 hover:bg-blue-700'}`}>
                  {busy?.type === key && busy.action === 'preview' ? 'Dosya analiz ediliyor...' : 'Önizle'}
                  <input disabled={Boolean(busy)} className="hidden" type="file" accept=".csv,.xlsx,.xls" onChange={(e) => previewFile(key, e.target.files?.[0])} />
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
        <Modal title={`Import Önizleme — ${preview.data.fileName}`} onClose={() => setPreview(null)} size="wide">
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
            {preview.type === 'courses' ? (
              <InstructorMappingPanel
                instructors={instructors}
                matched={preview.data.instructorMatches || []}
                unmatched={preview.data.unmatchedInstructors || []}
                mappings={instructorMappings}
                onChange={(courseCode, instructorId) => setInstructorMappings((current) => ({ ...current, [courseCode]: instructorId }))}
              />
            ) : null}
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
            <div className="sticky bottom-0 -mx-5 -mb-4 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
              <button type="button" onClick={() => setPreview(null)} className="rounded-md border px-4 py-2 text-sm dark:border-slate-700">İptal</button>
              <button
                type="button"
                onClick={() => upload(preview.type, preview.file)}
                disabled={previewHasHardErrors || Boolean(busy)}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy?.action === 'upload' ? 'Import işleniyor...' : 'Importu Başlat'}
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

function templateUrl(type: string) {
  const token = getToken();
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return getApiUrl(`/imports/templates/${type}.xlsx${query}`);
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

function InstructorMappingPanel({
  instructors,
  matched,
  unmatched,
  mappings,
  onChange,
}: {
  instructors: InstructorOption[];
  matched: InstructorPreview[];
  unmatched: InstructorPreview[];
  mappings: Record<string, string>;
  onChange: (courseCode: string, instructorId: string) => void;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Ders sorumlusu eşleştirmeleri</p>
          <p className="text-xs text-slate-500">Eşleşmeyen sorumlular varsayılan olarak yeni INSTRUCTOR hesabı olarak oluşturulur; isterseniz mevcut kullanıcı seçebilirsiniz.</p>
        </div>
        <span className="shrink-0 rounded bg-slate-50 px-2 py-1 text-xs text-slate-500 dark:bg-slate-950">{matched.length} eşleşti / {unmatched.length} kontrol</span>
      </div>

      {matched.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {matched.map((item) => (
            <span key={`${item.row}-${item.courseCode}`} className="rounded bg-green-50 px-2 py-1 text-xs text-green-700 dark:bg-green-950 dark:text-green-300">
              {item.courseCode}: {item.user?.name}
            </span>
          ))}
        </div>
      ) : null}

      {unmatched.length === 0 ? (
        <p className="text-sm text-slate-400">Manuel eşleştirme gerekmiyor.</p>
      ) : (
        <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
          {unmatched.map((item) => (
            <div key={`${item.row}-${item.courseCode}`} className="grid gap-3 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950 lg:grid-cols-[minmax(0,1fr)_minmax(260px,420px)]">
              <div className="min-w-0">
                <p className="font-semibold">{item.courseCode || `Satır ${item.row}`}</p>
                <p className="text-xs leading-5 text-slate-500">
                  {instructorStatusLabel(item.status)}{item.value ? `: ${item.value}` : ''}
                  {item.existingInstructorId ? ' - mevcut sorumlu korunabilir' : ' - varsayılan: hesap oluştur'}
                </p>
                {item.matches?.length ? (
                  <p className="mt-1 text-xs text-amber-600">Olası eşleşmeler: {item.matches.map((match) => match.name).join(', ')}</p>
                ) : null}
              </div>
              <select
                value={mappings[item.courseCode] || item.existingInstructorId || ''}
                onChange={(event) => onChange(item.courseCode, event.target.value)}
                className="min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                {!item.existingInstructorId ? <option value={CREATE_INSTRUCTOR_MAPPING}>Yeni ders sorumlusu hesabı oluştur</option> : null}
                <option value="">Ders sorumlusu seç</option>
                {instructors.map((instructor) => (
                  <option key={instructor.id} value={instructor.id}>{instructor.name} ({instructor.email})</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function instructorStatusLabel(status: InstructorPreview['status']) {
  if (status === 'ambiguous') return 'Birden fazla olası ders sorumlusu bulundu';
  if (status === 'unmatched') return 'Ders sorumlusu kullanıcısı bulunamadı';
  if (status === 'missing') return 'Ders sorumlusu boş geldi';
  return 'Eşleşti';
}
