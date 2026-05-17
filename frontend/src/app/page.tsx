'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StatusPill from '@/components/StatusPill';
import { apiFetch } from '@/lib/api';
import { canAccessPath, CurrentUser, getStoredUser, ROLE_LABELS } from '@/lib/auth';

type Dashboard = {
  counts: { students: number; courses: number; classrooms: number; invigilators: number; exams: number };
  warningCount: number;
  scenarios: Array<{ id: string; name: string; status: string; score: number; period?: { name: string } }>;
};
type Exam = {
  id: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  course: { code: string; name: string };
  roomAssignments?: Array<{ classroom: { name: string; code?: string } }>;
};

export default function Home() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [error, setError] = useState('');
  const [user] = useState<CurrentUser | null>(() => getStoredUser());

  useEffect(() => {
    apiFetch<Dashboard>('/dashboard')
      .then((response) => setDashboard(response.data))
      .catch((err) => setError(err.message));
    apiFetch<Exam[]>('/exams')
      .then((response) => setExams(response.data))
      .catch(() => setExams([]));
  }, []);

  const counts = dashboard?.counts;
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
            {exams.length ? exams.slice(0, 6).map((exam) => (
              <Link key={exam.id} href={`/sinavlar/${exam.id}`} className="grid gap-2 rounded-lg border border-slate-100 p-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950 md:grid-cols-[1fr_160px_1fr]">
                <div>
                  <p className="font-semibold">{exam.course.code}</p>
                  <p className="text-sm text-slate-500">{exam.course.name}</p>
                </div>
                <div className="text-sm">
                  <p>{exam.date ? new Date(exam.date).toLocaleDateString('tr-TR') : '-'}</p>
                  <p className="text-slate-500">{exam.startTime ? `${exam.startTime}-${exam.endTime}` : '-'}</p>
                </div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {exam.roomAssignments?.length ? exam.roomAssignments.map((assignment) => assignment.classroom.name).join(', ') : 'Salon henüz atanmadı'}
                </p>
              </Link>
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
    </div>
  );
}

function Metric({ title, value, href }: { title: string; value?: number; href: string }) {
  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white p-5 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-950">
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-bold">{value ?? '-'}</p>
    </Link>
  );
}
