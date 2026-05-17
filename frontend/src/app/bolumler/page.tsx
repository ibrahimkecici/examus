'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';
import Modal, { ConfirmDialog } from '@/components/Modal';
import { apiFetch } from '@/lib/api';

type Department = { id: string; code: string; name: string; _count?: { users: number; students: number; courses: number; invigilators: number } };

const emptyForm = { code: '', name: '' };

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editTarget, setEditTarget] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [error, setError] = useState('');

  async function load() {
    const response = await apiFetch<Department[]>('/departments');
    setDepartments(response.data);
  }

  useEffect(() => {
    apiFetch<Department[]>('/departments').then((response) => setDepartments(response.data)).catch(console.error);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await apiFetch('/departments', { method: 'POST', body: JSON.stringify({ code: form.code.toUpperCase(), name: form.name }) });
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bölüm kaydedilemedi.');
    }
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editTarget) return;
    setError('');
    try {
      await apiFetch(`/departments/${editTarget.id}`, { method: 'PUT', body: JSON.stringify({ code: form.code.toUpperCase(), name: form.name }) });
      setEditTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bölüm güncellenemedi.');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await apiFetch(`/departments/${deleteTarget.id}`, { method: 'DELETE' });
    setDeleteTarget(null);
    await load();
  }

  function startEdit(index: number) {
    const department = departments[index];
    setForm({ code: department.code, name: department.name });
    setEditTarget(department);
    setError('');
  }

  const inputCls = 'rounded-md border px-3 py-2 text-sm w-full dark:border-slate-700 dark:bg-slate-950';

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold">Bölümler</h2>
        <p className="text-slate-500">Rol kapsamı ve veri filtreleri için kullanılan güvenli bölüm kayıtları.</p>
      </header>

      <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-3">
        <input required placeholder="Kod" className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
        <input required placeholder="Bölüm adı" className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <button className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">Ekle</button>
      </form>
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">{error}</p> : null}

      <DataTable
        columns={['Kod', 'Ad', 'Kullanıcı', 'Öğrenci', 'Ders', 'Gözetmen']}
        rows={departments.map((department) => [
          department.code,
          department.name,
          department._count?.users ?? 0,
          department._count?.students ?? 0,
          department._count?.courses ?? 0,
          department._count?.invigilators ?? 0,
        ])}
        onEdit={startEdit}
        onDelete={(index) => setDeleteTarget(departments[index])}
      />

      {editTarget && (
        <Modal title={`Bölümü Düzenle — ${editTarget.code}`} onClose={() => setEditTarget(null)}>
          <form onSubmit={saveEdit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Kod</label>
              <input required className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Ad</label>
              <input required className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
          message={`"${deleteTarget.name}" bölümünü silmek istediğinizden emin misiniz? Bağlı kayıt varsa veritabanı bu silme işlemini reddedebilir.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
