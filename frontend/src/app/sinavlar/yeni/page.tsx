'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type Course = { id: string; code: string; name: string; durationMinutes: number };
type Period = { id: string; name: string };

export default function YeniSinav() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [form, setForm] = useState({ courseId: '', periodId: '', date: '', startTime: '', endTime: '', pinned: false });

  useEffect(() => {
    apiFetch<Course[]>('/courses').then((response) => setCourses(response.data)).catch(console.error);
    apiFetch<Period[]>('/exam-periods').then((response) => setPeriods(response.data)).catch(console.error);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await apiFetch('/exams', { method: 'POST', body: JSON.stringify(form) });
    router.push('/sinavlar');
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center gap-4">
        <Link href="/sinavlar" className="rounded-md border px-3 py-2">Geri</Link>
        <div>
          <h2 className="text-2xl font-bold">Yeni Sınav</h2>
          <p className="text-slate-500">Ders ve dönem seçerek sınav oluşturun.</p>
        </div>
      </header>
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <select required className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
          <option value="">Ders seçin</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.code} - {course.name}</option>)}
        </select>
        <select className="w-full rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={form.periodId} onChange={(e) => setForm({ ...form, periodId: e.target.value })}>
          <option value="">Dönem seçin</option>
          {periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-3">
          <input type="date" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input type="time" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          <input type="time" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} /> Bu sınav zamanını sabitle</label>
        <button className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white">Kaydet</button>
      </form>
    </div>
  );
}
