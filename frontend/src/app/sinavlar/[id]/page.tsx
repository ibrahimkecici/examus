'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DataTable from '@/components/DataTable';
import { apiFetch, formatDate } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

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
type OperationSeat = {
  id: string;
  classroomId?: string | null;
  classroom: string;
  classroomCode: string;
  rowCount: number;
  columnCount: number;
  seat: string;
  row: number;
  column: number;
  studentNo: string;
  studentName: string;
  specialNeeds?: string | null;
  bookletType?: string | null;
  courseCode: string;
};
type OperationRoom = {
  classroomId: string;
  classroom: string;
  classroomCode: string;
  capacity: number;
  examCapacity: number;
  rowCount: number;
  columnCount: number;
  assignedCount: number;
  physicalUtilization: number;
  examUtilization: number;
  seats: OperationSeat[];
  specialNeedsSummary: string;
};
type ExamOperation = {
  scenario: { id: string; name: string; status: string };
  role: string;
  summary: { assignedCount: number; roomCount: number; invigilatorCount: number; specialNeedsSummary: string };
  rooms: OperationRoom[];
  seats: OperationSeat[];
  invigilators: Array<{ id: string; name: string; staffNo: string; role: string }>;
};

export default function SinavDetay() {
  const params = useParams<{ id: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [editing, setEditing] = useState(false);
  const [user] = useState(() => getStoredUser());
  const [operation, setOperation] = useState<ExamOperation | null>(null);
  const [form, setForm] = useState({ courseId: '', periodId: '', date: '', startTime: '', endTime: '', durationMinutes: '120', pinned: false });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

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
    apiFetch<ExamOperation>(`/exams/${params.id}/operations`).then((r) => setOperation(r.data)).catch(() => setOperation(null));
    apiFetch<Course[]>('/courses').then((r) => setCourses(r.data)).catch(console.error);
    apiFetch<Period[]>('/exam-periods').then((r) => setPeriods(r.data)).catch(console.error);
  }, [params.id]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      await apiFetch(`/exams/${params.id}`, { method: 'PUT', body: JSON.stringify({ ...form, durationMinutes: Number(form.durationMinutes) }) });
      const r = await apiFetch<Exam>(`/exams/${params.id}`);
      setExam(r.data);
      setEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Değişiklik kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  if (!exam) return <div className="p-8 text-slate-500">Yükleniyor...</div>;

  const canEdit = ['ADMIN', 'DEPARTMENT_MANAGER', 'INSTRUCTOR'].includes(user?.role || '');
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
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)} className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">Düzenle</button>
        )}
      </header>

      {editing ? (
        <form onSubmit={save} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          {saveError ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">{saveError}</div> : null}
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

      {operation ? <OperationSection operation={operation} /> : null}
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

function OperationSection({ operation }: { operation: ExamOperation }) {
  return (
    <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Operasyon Bilgileri</h3>
          <p className="text-sm text-slate-500">{operation.scenario.name} · {operation.scenario.status}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <MiniStat label="Atanan" value={operation.summary.assignedCount} />
          <MiniStat label="Salon" value={operation.summary.roomCount} />
          <MiniStat label="Gözetmen" value={operation.summary.invigilatorCount} />
        </div>
      </div>

      {operation.invigilators.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Gözetmenler</p>
          <div className="flex flex-wrap gap-2">
            {operation.invigilators.map((assignment) => (
              <span key={assignment.id} className="rounded-md bg-slate-50 px-3 py-1.5 text-sm dark:bg-slate-950">
                {assignment.name} <span className="text-slate-400">({assignment.role})</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {operation.summary.specialNeedsSummary !== '-' ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Özel ihtiyaç özeti: {operation.summary.specialNeedsSummary}
        </div>
      ) : null}

      <div className="space-y-5">
        {operation.rooms.map((room) => (
          <div key={room.classroomId} className="rounded-lg border border-slate-100 p-4 dark:border-slate-800">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{room.classroom} <span className="font-mono text-sm text-slate-400">({room.classroomCode})</span></p>
                <p className="text-sm text-slate-500">
                  {room.assignedCount}/{room.examCapacity} sınav kapasitesi · {room.assignedCount}/{room.capacity} fiziksel kapasite
                </p>
              </div>
              {room.specialNeedsSummary !== '-' ? <span className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">{room.specialNeedsSummary}</span> : null}
            </div>
            <OperationSeatGrid room={room} />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Koltuk</th>
                    <th className="px-3 py-2 text-left font-semibold">Öğrenci No</th>
                    <th className="px-3 py-2 text-left font-semibold">Ad Soyad</th>
                    <th className="px-3 py-2 text-left font-semibold">Kitapçık</th>
                    <th className="px-3 py-2 text-left font-semibold">Not</th>
                  </tr>
                </thead>
                <tbody>
                  {room.seats.map((seat) => (
                    <tr key={seat.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2 font-semibold">{seat.seat}</td>
                      <td className="px-3 py-2">{seat.studentNo}</td>
                      <td className="px-3 py-2">{seat.studentName}</td>
                      <td className="px-3 py-2">{seat.bookletType || '-'}</td>
                      <td className="px-3 py-2">{seat.specialNeeds || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function OperationSeatGrid({ room }: { room: OperationRoom }) {
  const seatByPosition = new Map(room.seats.map((seat) => [`${seat.row}-${seat.column}`, seat]));
  const rows = room.rowCount || Math.max(...room.seats.map((seat) => seat.row), 1);
  const columns = room.columnCount || Math.max(...room.seats.map((seat) => seat.column), 1);
  const cells = Array.from({ length: rows }, (_, rowIndex) =>
    Array.from({ length: columns }, (_, columnIndex) => seatByPosition.get(`${rowIndex + 1}-${columnIndex + 1}`) || null),
  );

  return (
    <div className="overflow-x-auto">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(72px, 1fr))`, maxWidth: Math.max(columns * 92, 240) }}>
        {cells.flat().map((seat, index) => (
          <div
            key={seat ? seat.id : `empty-${index}`}
            className={`min-h-16 rounded-md border p-2 text-xs ${seat ? 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100' : 'border-dashed border-slate-200 text-slate-300 dark:border-slate-700 dark:text-slate-600'}`}
          >
            {seat ? (
              <>
                <p className="font-bold">{seat.seat}</p>
                <p className="truncate">{seat.studentNo}</p>
                <p className="truncate text-[11px] opacity-80">{seat.studentName}</p>
                <p className="text-[10px] opacity-70">Kitapçık: {seat.bookletType || '-'}</p>
              </>
            ) : (
              <span>Boş</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-950">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}
