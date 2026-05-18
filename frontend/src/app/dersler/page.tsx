'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';
import Modal, { ConfirmDialog } from '@/components/Modal';
import { apiFetch } from '@/lib/api';
import { canManageResource, getStoredUser } from '@/lib/auth';

type Course = { id: string; code: string; name: string; instructorName?: string; instructorId?: string | null; instructor?: { id: string; name: string; email: string } | null; studentCount: number; durationMinutes: number; examType: string; department?: string | null; departmentId?: string | null };
type Department = { id: string; name: string };
type Instructor = { id: string; name: string; email: string };

const emptyForm = { code: '', name: '', instructorId: '', studentCount: '0', durationMinutes: '120', departmentId: '' };

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editTarget, setEditTarget] = useState<Course | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [user] = useState(() => getStoredUser());
  const canManage = canManageResource(user, 'courses');

  async function load() {
    const [response, departmentResponse, instructorResponse] = await Promise.all([
      apiFetch<Course[]>('/courses'),
      apiFetch<Department[]>('/departments'),
      canManage ? apiFetch<Instructor[]>('/users?role=INSTRUCTOR') : Promise.resolve({ data: [] as Instructor[] }),
    ]);
    setCourses(response.data);
    setDepartments(departmentResponse.data);
    setInstructors(instructorResponse.data);
  }

  useEffect(() => {
    Promise.all([
      apiFetch<Course[]>('/courses'),
      apiFetch<Department[]>('/departments'),
      canManage ? apiFetch<Instructor[]>('/users?role=INSTRUCTOR') : Promise.resolve({ data: [] as Instructor[] }),
    ])
      .then(([response, departmentResponse, instructorResponse]) => {
        setCourses(response.data);
        setDepartments(departmentResponse.data);
        setInstructors(instructorResponse.data);
      })
      .catch(console.error);
  }, [canManage]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload = { ...form, studentCount: Number(form.studentCount), durationMinutes: Number(form.durationMinutes) };
    await apiFetch('/courses', { method: 'POST', body: JSON.stringify(payload) });
    setForm(emptyForm);
    await load();
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editTarget) return;
    const payload = { ...form, studentCount: Number(form.studentCount), durationMinutes: Number(form.durationMinutes) };
    await apiFetch(`/courses/${editTarget.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    setEditTarget(null);
    await load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await apiFetch(`/courses/${deleteTarget.id}`, { method: 'DELETE' });
    setDeleteTarget(null);
    await load();
  }

  function startEdit(index: number) {
    const c = courses[index];
    setForm({ code: c.code, name: c.name, instructorId: c.instructorId || '', studentCount: String(c.studentCount), durationMinutes: String(c.durationMinutes), departmentId: c.departmentId || '' });
    setEditTarget(c);
  }

  const inputCls = 'rounded-md border px-3 py-2 text-sm w-full dark:border-slate-700 dark:bg-slate-950';

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold">Dersler</h2>
        <p className="text-slate-500">Ders, sınav süresi ve öğretim elemanı bilgileri.</p>
      </header>

      {canManage ? <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-7">
        <input required placeholder="Ders Kodu" className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
        <input required placeholder="Ders Adı" className={`${inputCls} md:col-span-2`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select required className={inputCls} value={form.instructorId} onChange={(e) => setForm({ ...form, instructorId: e.target.value })}>
          <option value="">Ders Sorumlusu</option>
          {instructors.map((instructor) => <option key={instructor.id} value={instructor.id}>{instructor.name} ({instructor.email})</option>)}
        </select>
        <input type="number" placeholder="Öğrenci" className={inputCls} value={form.studentCount} onChange={(e) => setForm({ ...form, studentCount: e.target.value })} />
        <select className={inputCls} value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
          <option value="">Bölüm</option>
          {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>
        <button className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">Ekle</button>
      </form> : null}

      <DataTable
        columns={['Kod', 'Ad', 'Öğretim Elemanı', 'Bölüm', 'Öğrenci', 'Süre', 'Tür']}
        rows={courses.map((c) => [c.code, c.name, c.instructor?.name || c.instructorName || <span key={c.id} className="text-amber-600">Sorumlu atanmadı</span>, c.department || '-', c.studentCount, `${c.durationMinutes} dk`, c.examType])}
        onEdit={canManage ? startEdit : undefined}
        onDelete={canManage ? (i) => setDeleteTarget(courses[i]) : undefined}
      />

      {editTarget && (
        <Modal title={`Dersi Düzenle — ${editTarget.code}`} onClose={() => setEditTarget(null)}>
          <form onSubmit={saveEdit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Ders Kodu</label>
                <input required className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Öğrenci Sayısı</label>
                <input type="number" required className={inputCls} value={form.studentCount} onChange={(e) => setForm({ ...form, studentCount: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Ders Adı</label>
              <input required className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Ders Sorumlusu</label>
              <select required className={inputCls} value={form.instructorId} onChange={(e) => setForm({ ...form, instructorId: e.target.value })}>
                <option value="">Ders sorumlusu seçin</option>
                {instructors.map((instructor) => <option key={instructor.id} value={instructor.id}>{instructor.name} ({instructor.email})</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Bölüm</label>
              <select className={inputCls} value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">Mevcut bölüm değişmesin</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Sınav Süresi (dk)</label>
              <input type="number" required className={inputCls} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditTarget(null)} className="rounded-md border px-4 py-2 text-sm dark:border-slate-700">İptal</button>
              <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Kaydet</button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`"${deleteTarget.code} — ${deleteTarget.name}" dersini silmek istediğinizden emin misiniz?`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
