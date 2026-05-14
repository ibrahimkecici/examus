'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';
import { apiFetch } from '@/lib/api';

type Student = { id: string; studentNo: string; fullName: string; department: string; classLevel?: number; enrollments: Array<{ course: { code: string } }> };

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [form, setForm] = useState({ studentNo: '', fullName: '', department: '' });

  async function load() {
    const response = await apiFetch<Student[]>('/students');
    setStudents(response.data);
  }

  useEffect(() => {
    apiFetch<Student[]>('/students').then((response) => setStudents(response.data)).catch(console.error);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await apiFetch('/students', { method: 'POST', body: JSON.stringify(form) });
    setForm({ studentNo: '', fullName: '', department: '' });
    await load();
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold">Öğrenciler</h2>
        <p className="text-slate-500">Öğrenci kayıtları ve ders eşleşmeleri.</p>
      </header>
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-4">
        <input required placeholder="Öğrenci No" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={form.studentNo} onChange={(e) => setForm({ ...form, studentNo: e.target.value })} />
        <input required placeholder="Ad Soyad" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <input required placeholder="Bölüm" className="rounded-md border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
        <button className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white">Ekle</button>
      </form>
      <DataTable columns={['No', 'Ad Soyad', 'Bölüm', 'Dersler']} rows={students.map((student) => [student.studentNo, student.fullName, student.department, student.enrollments.map((enrollment) => enrollment.course.code).join(', ') || '-'])} />
    </div>
  );
}
