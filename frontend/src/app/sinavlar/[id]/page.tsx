'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DataTable from '@/components/DataTable';
import { apiFetch, formatDate } from '@/lib/api';

type Course = { id: string; code: string; name: string; instructorName?: string; studentCount: number };
type Period = { id: string; name: string };
type Exam = {
  id: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes: number;
  status: string;
  pinned: boolean;
  courseId: string;
  periodId?: string;
  course: Course;
  roomAssignments: Array<{ classroom: { name: string; capacity: number }; assignedCount: number }>;
};

export default function SinavDetay() {
  const params = useParams<{ id: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ courseId: '', periodId: '', date: '', startTime: '', endTime: '', durationMinutes: '120', pinned: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Exam>(`/exams/${params.id}`).then((r) => {
      setExam(r.data);
      setForm({
        courseId: r.data.courseId,
        periodId: r.data.periodId || '',
        date: r.data.date ? r.data.date.slice(0, 10) : '',
        startTime: r.data.startTime || '',
        endTime: r.data.endTime || '',
        durationMinutes: String(r.data.durationMinutes),
        pinned: r.data.pinned,
      });
    }).catch(console.error);
    apiFetch<Course[]>('/courses').then((r) => setCourses(r.data)).catch(console.error);
    apiFetch<Period[]>('/exam-periods').then((r) => setPeriods(r.data)).catch(console.error);
  }, [params.id]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/exams/${params.id}`, { method: 'PUT', body: JSON.stringify({ ...form, durationMinutes: Number(form.durationMinutes) }) });
      const r = await apiFetch<Exam>(`/exams/${params.id}`);
      setExam(r.data);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!exam) return <div className="p-8 text-slate-500">Yükleniyor...</div>;

  const inputCls = 'rounded-md border px-3 py-2 text-sm w-full dark:border-slate-700 dark:bg-slate-950';

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Link href="/sinavlar" className="rounded-md border px-3 py-2 text-sm">Geri</Link>
        <div className="flex-1">
          <p className="font-mono text-sm text-blue-600">{exam.course.code}</p>
          <h2 className="text-3xl font-bold">{exam.course.name}</h2>
          <p className="text-slate-500">{formatDate(exam.date)} {exam.startTime ? `${exam.startTime}-${exam.endTime}` : ''}</p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">Düzenle</button>
        )}
      </header>

      {editing ? (
        <form onSubmit={save} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Ders</label>
            <select required className={inputCls} value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
              <option value="">Ders seçin</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Dönem</label>
            <select className={inputCls} value={form.periodId} onChange={(e) => setForm({ ...form, periodId: e.target.value })}>
              <option value="">Dönem seçin</option>
              {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Tarih</label>
              <input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Başlangıç</label>
              <input type="time" className={inputCls} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Bitiş</label>
              <input type="time" className={inputCls} value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Süre (dk)</label>
              <input type="number" className={inputCls} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
            Bu sınavın zamanını sabitle
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-md border px-4 py-2 text-sm dark:border-slate-700">İptal</button>
          </div>
        </form>
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Info title="Öğretim Elemanı" value={exam.course.instructorName || '-'} />
          <Info title="Öğrenci Sayısı" value={String(exam.course.studentCount)} />
          <Info title="Durum" value={exam.status} />
        </section>
      )}

      <DataTable
        columns={['Derslik', 'Kapasite', 'Atanan']}
        rows={exam.roomAssignments.map((a) => [a.classroom.name, a.classroom.capacity, a.assignedCount])}
        emptyText="Bu sınav henüz bir senaryoda salona atanmadı."
      />
    </div>
  );
}

function Info({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}
