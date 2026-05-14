'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';
import { apiFetch } from '@/lib/api';

type Course = { id: string; code: string; name: string; instructorName?: string; studentCount: number; durationMinutes: number; examType: string };

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState({ code: '', name: '', instructorName: '', studentCount: '0', durationMinutes: '120' });

  async function load() {
    const response = await apiFetch<Course[]>('/courses');
    setCourses(response.data);
  }

  useEffect(() => {
    apiFetch<Course[]>('/courses').then((response) => setCourses(response.data)).catch(console.error);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await apiFetch('/courses', { method: 'POST', body: JSON.stringify({ ...form, studentCount: Number(form.studentCount), durationMinutes: Number(form.durationMinutes) }) });
    setForm({ code: '', name: '', instructorName: '', studentCount: '0', durationMinutes: '120' });
    await load();
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold">Dersler</h2>
        <p className="text-slate-500">Ders, sınav süresi ve öğretim elemanı bilgileri.</p>
      </header>
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-6">
        <input required placeholder="Ders Kodu" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
        <input required placeholder="Ders Adı" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950 md:col-span-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Öğretim Elemanı" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={form.instructorName} onChange={(e) => setForm({ ...form, instructorName: e.target.value })} />
        <input type="number" placeholder="Öğrenci" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={form.studentCount} onChange={(e) => setForm({ ...form, studentCount: e.target.value })} />
        <button className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white">Ekle</button>
      </form>
      <DataTable columns={['Kod', 'Ad', 'Öğretim Elemanı', 'Öğrenci', 'Süre', 'Tür']} rows={courses.map((course) => [course.code, course.name, course.instructorName || '-', course.studentCount, `${course.durationMinutes} dk`, course.examType])} />
    </div>
  );
}
