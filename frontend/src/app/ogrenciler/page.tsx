'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';
import Modal, { ConfirmDialog } from '@/components/Modal';
import { apiFetch } from '@/lib/api';

type Student = { id: string; studentNo: string; fullName: string; department: string; classLevel?: number; specialNeeds?: string; enrollments: Array<{ course: { code: string } }> };
type Department = { id: string; name: string };

const emptyForm = { studentNo: '', fullName: '', department: '', departmentId: '', specialNeeds: '' };

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editTarget, setEditTarget] = useState<Student | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);

  async function load() {
    const [response, departmentResponse] = await Promise.all([apiFetch<Student[]>('/students'), apiFetch<Department[]>('/departments')]);
    setStudents(response.data);
    setDepartments(departmentResponse.data);
  }

  useEffect(() => {
    Promise.all([apiFetch<Student[]>('/students'), apiFetch<Department[]>('/departments')])
      .then(([response, departmentResponse]) => {
        setStudents(response.data);
        setDepartments(departmentResponse.data);
      })
      .catch(console.error);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await apiFetch('/students', { method: 'POST', body: JSON.stringify(form) });
    setForm(emptyForm);
    await load();
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editTarget) return;
    await apiFetch(`/students/${editTarget.id}`, { method: 'PUT', body: JSON.stringify(form) });
    setEditTarget(null);
    await load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await apiFetch(`/students/${deleteTarget.id}`, { method: 'DELETE' });
    setDeleteTarget(null);
    await load();
  }

  function startEdit(index: number) {
    const s = students[index];
    setForm({ studentNo: s.studentNo, fullName: s.fullName, department: s.department, departmentId: '', specialNeeds: s.specialNeeds || '' });
    setEditTarget(s);
  }

  const inputCls = 'rounded-md border px-3 py-2 text-sm w-full dark:border-slate-700 dark:bg-slate-950';

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold">Öğrenciler</h2>
        <p className="text-slate-500">Öğrenci kayıtları ve ders eşleşmeleri.</p>
      </header>

      <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-5">
        <input required placeholder="Öğrenci No" className={inputCls} value={form.studentNo} onChange={(e) => setForm({ ...form, studentNo: e.target.value })} />
        <input required placeholder="Ad Soyad" className={inputCls} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <select required className={inputCls} value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value, department: departments.find((d) => d.id === e.target.value)?.name || '' })}>
          <option value="">Bölüm seçin</option>
          {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>
        <input placeholder="Özel İhtiyaç (isteğe bağlı)" className={inputCls} value={form.specialNeeds} onChange={(e) => setForm({ ...form, specialNeeds: e.target.value })} />
        <button className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">Ekle</button>
      </form>

      <DataTable
        columns={['No', 'Ad Soyad', 'Bölüm', 'Dersler']}
        rows={students.map((s) => [s.studentNo, s.fullName, s.department, s.enrollments.map((e) => e.course.code).join(', ') || '-'])}
        onEdit={startEdit}
        onDelete={(i) => setDeleteTarget(students[i])}
      />

      {editTarget && (
        <Modal title={`Öğrenciyi Düzenle — ${editTarget.studentNo}`} onClose={() => setEditTarget(null)}>
          <form onSubmit={saveEdit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Öğrenci No</label>
              <input required className={inputCls} value={form.studentNo} onChange={(e) => setForm({ ...form, studentNo: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Ad Soyad</label>
              <input required className={inputCls} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Bölüm</label>
              <select required className={inputCls} value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value, department: departments.find((d) => d.id === e.target.value)?.name || form.department })}>
                <option value="">{form.department || 'Bölüm seçin'}</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Özel İhtiyaç</label>
              <input className={inputCls} placeholder="Örn: tekerlekli sandalye, ek süre" value={form.specialNeeds} onChange={(e) => setForm({ ...form, specialNeeds: e.target.value })} />
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
          message={`"${deleteTarget.fullName} (${deleteTarget.studentNo})" öğrencisini silmek istediğinizden emin misiniz?`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
