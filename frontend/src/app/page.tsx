'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StatusPill from '@/components/StatusPill';
import { apiFetch, getApiBaseUrl, getToken } from '@/lib/api';
import { canAccessPath, CurrentUser, getStoredUser, ROLE_LABELS } from '@/lib/auth';

type Dashboard = {
  counts: { students: number; courses: number; classrooms: number; invigilators: number; exams: number };
  warningCount: number;
  scenarios: Array<{ id: string; name: string; status: string; score: number; period?: { name: string } }>;
  operationalItems: OperationalItem[];
};
type OperationalItem = {
  kind: 'student_exam' | 'invigilator_task' | 'instructor_exam';
  scenarioId?: string;
  scenarioName?: string;
  examId: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  courseCode: string;
  courseName: string;
  classroom?: string;
  classroomCode?: string | null;
  classrooms?: string[];
  seat?: string;
  bookletType?: string | null;
  assignedCount?: number;
  expectedCount?: number;
  role?: string;
  invigilators?: string[];
  seatingPreview?: Array<{
    classroom: string;
    seat: string;
    studentNo: string;
    studentName: string;
    bookletType?: string | null;
  }>;
  seatingAssignments?: SeatingAssignment[];
};
type SeatingAssignment = {
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
  bookletType?: string | null;
};

export default function Home() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [user] = useState<CurrentUser | null>(() => getStoredUser());
  const [selectedSeating, setSelectedSeating] = useState<OperationalItem | null>(null);

  useEffect(() => {
    apiFetch<Dashboard>('/dashboard')
      .then((response) => setDashboard(response.data))
      .catch((err) => setError(err.message));
  }, []);

  const counts = dashboard?.counts;
  const operationalItems = dashboard?.operationalItems || [];
  const isPlanningRole = user?.role === 'ADMIN' || user?.role === 'DEPARTMENT_MANAGER';
  const metrics = [
    { title: user?.role === 'STUDENT' ? 'Profil' : 'Öğrenci', value: counts?.students, href: '/ogrenciler' },
    { title: 'Ders', value: counts?.courses, href: '/dersler' },
    { title: 'Derslik', value: counts?.classrooms, href: '/derslikler' },
    { title: user?.role === 'INVIGILATOR' ? 'Profil' : 'Gözetmen', value: counts?.invigilators, href: '/gozetmenler' },
    { title: 'Sınav', value: counts?.exams, href: '/sinavlar' },
  ].filter((metric) => canAccessPath(user, metric.href));

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold">Kontrol Paneli</h2>
        <p className="mt-1 text-slate-500">
          {user?.role ? `${ROLE_LABELS[user.role]} yetkilerinizle erişebildiğiniz kayıtları görüntülüyorsunuz.` : 'Sınav dönemi, veri kalitesi, planlama ve rapor durumunu izleyin.'}
        </p>
      </header>

      {error ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</div> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {metrics.map((metric) => <Metric key={metric.href} {...metric} />)}
      </div>

      {user?.role === 'STUDENT' || user?.role === 'INSTRUCTOR' || user?.role === 'INVIGILATOR' ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">{user.role === 'INVIGILATOR' ? 'Görevlerim' : 'Sınavlarım'}</h3>
            <Link className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-950" href="/sinavlar">
              Tümünü aç
            </Link>
          </div>
          <div className="space-y-3">
            {operationalItems.length ? operationalItems.slice(0, 8).map((item) => (
              <article key={`${item.kind}-${item.scenarioId || 'exam'}-${item.examId}-${item.seat || item.role || ''}`} className="rounded-lg border border-slate-100 p-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950">
                <div className="grid gap-3 md:grid-cols-[1fr_160px_1fr]">
                <div>
                  <Link href={`/sinavlar/${item.examId}`} className="font-semibold text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400">{item.courseCode}</Link>
                  <p className="text-sm text-slate-500">{item.courseName}</p>
                  {item.scenarioName ? <p className="mt-1 text-xs text-slate-400">{item.scenarioName}</p> : null}
                </div>
                <div className="text-sm">
                  <p>{item.date ? new Date(item.date).toLocaleDateString('tr-TR') : '-'}</p>
                  <p className="text-slate-500">{item.startTime ? `${item.startTime}-${item.endTime}` : '-'}</p>
                </div>
                <OperationalDetail item={item} />
                </div>
                {item.kind === 'invigilator_task' ? <InvigilatorSeatingPreview item={item} onOpen={() => setSelectedSeating(item)} /> : null}
              </article>
            )) : (
              <p className="rounded-lg bg-slate-50 p-6 text-center text-slate-500 dark:bg-slate-950">Görüntülenecek sınav bulunamadı.</p>
            )}
          </div>
        </section>
      ) : null}

      {isPlanningRole ? <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Son Planlama Senaryoları</h3>
            <Link className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white" href="/planlama">
              Planlama
            </Link>
          </div>
          <div className="space-y-3">
            {dashboard?.scenarios?.length ? (
              dashboard.scenarios.map((scenario) => (
                <Link key={scenario.id} href={`/planlama?scenario=${scenario.id}`} className="flex items-center justify-between rounded-lg border border-slate-100 p-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950">
                  <div>
                    <p className="font-semibold">{scenario.name}</p>
                    <p className="text-sm text-slate-500">{scenario.period?.name || 'Dönem atanmamış'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill tone={scenario.status === 'APPROVED' ? 'green' : 'blue'}>{scenario.status}</StatusPill>
                    <span className="font-mono text-sm">{Math.round(scenario.score)}</span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="rounded-lg bg-slate-50 p-6 text-center text-slate-500 dark:bg-slate-950">Henüz senaryo yok.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-lg font-semibold">Plan Sağlığı</h3>
          <div className="mt-6 text-5xl font-bold">{dashboard?.warningCount ?? 0}</div>
          <p className="mt-2 text-sm text-slate-500">Son senaryolardaki toplam uyarı sayısı</p>
          <Link href="/raporlar" className="mt-6 inline-flex rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-950">
            Raporları aç
          </Link>
        </div>
      </section> : null}

      {selectedSeating ? <SeatingModal item={selectedSeating} onClose={() => setSelectedSeating(null)} /> : null}
    </div>
  );
}

function scenarioReportUrl(scenarioId?: string) {
  if (!scenarioId) return null;
  return `${getApiBaseUrl()}/reports/scenarios/${scenarioId}/full.pdf?token=${encodeURIComponent(getToken() || '')}`;
}

function OperationalDetail({ item }: { item: OperationalItem }) {
  if (item.kind === 'student_exam') {
    return (
      <div className="text-sm text-slate-700 dark:text-slate-200">
        <p><span className="text-slate-500">Salon:</span> {item.classroom || '-'}</p>
        <p><span className="text-slate-500">Koltuk:</span> <span className="font-semibold">{item.seat || '-'}</span></p>
        <p><span className="text-slate-500">Kitapçık:</span> {item.bookletType || '-'}</p>
      </div>
    );
  }
  if (item.kind === 'invigilator_task') {
    return (
      <div className="text-sm text-slate-700 dark:text-slate-200">
        <p><span className="text-slate-500">Salon:</span> {item.classroom || '-'}</p>
        <p><span className="text-slate-500">Rol:</span> {item.role || '-'}</p>
        <p><span className="text-slate-500">Öğrenci:</span> {item.assignedCount ?? '-'}</p>
      </div>
    );
  }
  return (
    <div className="text-sm text-slate-700 dark:text-slate-200">
      <p><span className="text-slate-500">Salon:</span> {item.classrooms?.length ? item.classrooms.join(', ') : '-'}</p>
      <p><span className="text-slate-500">Atama:</span> {item.assignedCount ?? 0}/{item.expectedCount ?? '-'}</p>
      <p><span className="text-slate-500">Gözetmen:</span> {item.invigilators?.length ? item.invigilators.join(', ') : '-'}</p>
    </div>
  );
}

function InvigilatorSeatingPreview({ item, onOpen }: { item: OperationalItem; onOpen: () => void }) {
  const reportUrl = scenarioReportUrl(item.scenarioId);
  const seats = item.seatingPreview || [];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen();
      }}
      className="mt-4 block w-full border-t border-slate-100 pt-4 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Oturma düzeni önizleme</p>
        {reportUrl ? (
          <a
            href={reportUrl}
            onClick={(event) => event.stopPropagation()}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-white dark:border-slate-700 dark:hover:bg-slate-900"
          >
            Tam oturma düzeni PDF
          </a>
        ) : null}
      </div>
      {seats.length > 0 ? (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {seats.map((seat, index) => (
            <div key={`${seat.classroom}-${seat.seat}-${seat.studentNo}-${index}`} className="rounded-md bg-slate-50 px-3 py-2 text-xs dark:bg-slate-950">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{seat.classroom} / {seat.seat}</p>
              <p className="truncate text-slate-600 dark:text-slate-300">{seat.studentNo} - {seat.studentName}</p>
              <p className="text-slate-500">Kitapçık: {seat.bookletType || '-'}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-950">Bu görev için oturma kaydı henüz oluşmamış.</p>
      )}
      {seats.length > 0 ? <p className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400">Tam listeyi görmek için tıklayın.</p> : null}
    </div>
  );
}

function SeatingModal({ item, onClose }: { item: OperationalItem; onClose: () => void }) {
  const grouped = groupSeatingByClassroom(item.seatingAssignments || []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <div>
            <p className="font-mono text-sm text-blue-600 dark:text-blue-400">{item.courseCode}</p>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Oturma Düzeni</h3>
            <p className="text-sm text-slate-500">
              {item.courseName} · {item.date ? new Date(item.date).toLocaleDateString('tr-TR') : '-'} {item.startTime ? `${item.startTime}-${item.endTime}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-950">
            Kapat
          </button>
        </div>
        <div className="max-h-[calc(90vh-96px)] space-y-6 overflow-y-auto p-4">
          {grouped.length > 0 ? grouped.map((group) => (
            <section key={group.key} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{group.classroom}</p>
                  <p className="text-sm text-slate-500">{group.seats.length} öğrenci · {group.columnCount} sütun x {group.rowCount} sıra</p>
                </div>
              </div>
              <FullSeatingGrid group={group} />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Koltuk</th>
                      <th className="px-3 py-2 text-left font-semibold">Öğrenci No</th>
                      <th className="px-3 py-2 text-left font-semibold">Ad Soyad</th>
                      <th className="px-3 py-2 text-left font-semibold">Kitapçık</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.seats.map((seat) => (
                      <tr key={`${group.key}-${seat.seat}-${seat.studentNo}`} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2 font-semibold">{seat.seat}</td>
                        <td className="px-3 py-2">{seat.studentNo}</td>
                        <td className="px-3 py-2">{seat.studentName}</td>
                        <td className="px-3 py-2">{seat.bookletType || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )) : (
            <p className="rounded-lg bg-slate-50 p-6 text-center text-slate-500 dark:bg-slate-950">Bu görev için oturma kaydı henüz oluşmamış.</p>
          )}
        </div>
      </div>
    </div>
  );
}

type SeatingGroup = {
  key: string;
  classroom: string;
  rowCount: number;
  columnCount: number;
  seats: SeatingAssignment[];
};

function FullSeatingGrid({ group }: { group: SeatingGroup }) {
  const seatByPosition = new Map(group.seats.map((seat) => [`${seat.row}-${seat.column}`, seat]));
  const cells = Array.from({ length: group.rowCount }, (_, rowIndex) =>
    Array.from({ length: group.columnCount }, (_, columnIndex) => seatByPosition.get(`${rowIndex + 1}-${columnIndex + 1}`) || null),
  );

  return (
    <div className="overflow-x-auto">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${group.columnCount}, minmax(72px, 1fr))`, maxWidth: Math.max(group.columnCount * 92, 240) }}>
        {cells.flat().map((seat, index) => (
          <div
            key={seat ? `${seat.seat}-${seat.studentNo}` : `empty-${index}`}
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

function groupSeatingByClassroom(seats: SeatingAssignment[]): SeatingGroup[] {
  const groups = new Map<string, SeatingGroup>();
  for (const seat of seats) {
    const key = seat.classroomId || seat.classroomCode || seat.classroom;
    if (!groups.has(key)) {
      const classroomSeats = seats.filter((item) => (item.classroomId || item.classroomCode || item.classroom) === key);
      groups.set(key, {
        key,
        classroom: `${seat.classroom} (${seat.classroomCode})`,
        rowCount: seat.rowCount || Math.max(...classroomSeats.map((item) => item.row), 1),
        columnCount: seat.columnCount || Math.max(...classroomSeats.map((item) => item.column), 1),
        seats: [],
      });
    }
    groups.get(key)?.seats.push(seat);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    seats: group.seats.sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.column - b.column;
    }),
  }));
}

function Metric({ title, value, href }: { title: string; value?: number; href: string }) {
  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white p-5 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-950">
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-bold">{value ?? '-'}</p>
    </Link>
  );
}
