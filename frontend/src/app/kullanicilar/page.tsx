'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';
import Modal, { ConfirmDialog } from '@/components/Modal';
import { apiFetch } from '@/lib/api';
import { ROLE_LABELS, Role } from '@/lib/auth';

type User = { id: string; name: string; email: string; role: Role; department?: string | null; createdAt: string };
type Department = { id: string; code: string; name: string };
type Student = { id: string; studentNo: string; fullName: string; userId?: string | null };

const emptyForm = { email: '', name: '', password: '', role: 'DEPARTMENT_MANAGER' as Role, departmentId: '', studentId: '' };
const roles = Object.entries(ROLE_LABELS) as Array<[Role, string]>;

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const [response, departmentResponse, studentResponse] = await Promise.all([
      apiFetch<User[]>('/users'),
      apiFetch<Department[]>('/departments'),
      apiFetch<Student[]>('/students'),
    ]);
    setUsers(response.data);
    setDepartments(departmentResponse.data);
    setStudents(studentResponse.data);
  }

  useEffect(() => {
    Promise.all([apiFetch<User[]>('/users'), apiFetch<Department[]>('/departments'), apiFetch<Student[]>('/students')])
      .then(([response, departmentResponse, studentResponse]) => {
        setUsers(response.data);
        setDepartments(departmentResponse.data);
        setStudents(studentResponse.data);
      })
      .catch(console.error);
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/users', { method: 'POST', body: JSON.stringify(form) });
      setForm(emptyForm);
      setCreateOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata oluştu.');
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setError('');
    try {
      const body: Record<string, string> = { email: form.email, name: form.name, role: form.role, departmentId: form.departmentId, studentId: form.studentId };
      if (form.password) body.password = form.password;
      await apiFetch(`/users/${editTarget.id}`, { method: 'PUT', body: JSON.stringify(body) });
      setEditTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata oluştu.');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await apiFetch(`/users/${deleteTarget.id}`, { method: 'DELETE' });
    setDeleteTarget(null);
    await load();
  }

  function startEdit(index: number) {
    const u = users[index];
    setForm({ email: u.email, name: u.name || '', password: '', role: u.role, departmentId: '', studentId: '' });
    setEditTarget(u);
    setError('');
  }

  function openCreate() {
    setForm(emptyForm);
    setError('');
    setCreateOpen(true);
  }

  const inputCls = 'rounded-md border px-3 py-2 text-sm w-full dark:border-slate-700 dark:bg-slate-950';

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Kullanıcılar</h2>
          <p className="text-slate-500">Sistem kullanıcılarını yönetin.</p>
        </div>
        <button onClick={openCreate} className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">
          + Yeni Kullanıcı
        </button>
      </header>

      <DataTable
        columns={['E-posta', 'Ad Soyad', 'Rol', 'Bölüm']}
        rows={users.map((u) => [u.email, u.name || '-', ROLE_LABELS[u.role] || u.role, u.department || '-'])}
        onEdit={startEdit}
        onDelete={(i) => setDeleteTarget(users[i])}
      />

      {createOpen && (
        <Modal title="Yeni Kullanıcı" onClose={() => setCreateOpen(false)}>
          <form onSubmit={create} className="space-y-3">
            {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">{error}</p>}
            <div>
              <label className="mb-1 block text-xs text-slate-500">E-posta</label>
              <input required={form.role !== 'STUDENT'} type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={form.role === 'STUDENT' ? 'Boş bırakılırsa sistem üretir' : ''} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Ad Soyad</label>
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            {form.role !== 'STUDENT' ? <div>
              <label className="mb-1 block text-xs text-slate-500">Şifre</label>
              <input required type="password" className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div> : null}
            <div>
              <label className="mb-1 block text-xs text-slate-500">Rol</label>
              <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            {form.role === 'STUDENT' ? (
              <div>
                <label className="mb-1 block text-xs text-slate-500">Öğrenci Profili</label>
                <select required className={inputCls} value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
                  <option value="">Öğrenci seçin</option>
                  {students.map((student) => <option key={student.id} value={student.id}>{student.studentNo} - {student.fullName}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-500">Varsayılan şifre 12345678 olur ve ilk girişte değiştirilir.</p>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs text-slate-500">Bölüm</label>
                <select className={inputCls} value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                  <option value="">Bölüm yok</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="rounded-md border px-4 py-2 text-sm dark:border-slate-700">İptal</button>
              <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Oluştur</button>
            </div>
          </form>
        </Modal>
      )}

      {editTarget && (
        <Modal title={`Kullanıcıyı Düzenle — ${editTarget.email}`} onClose={() => setEditTarget(null)}>
          <form onSubmit={saveEdit} className="space-y-3">
            {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">{error}</p>}
            <div>
              <label className="mb-1 block text-xs text-slate-500">E-posta</label>
              <input required type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Ad Soyad</label>
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Yeni Şifre (boş bırakılırsa değişmez)</label>
              <input type="password" className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Rol</label>
              <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
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
          message={`"${deleteTarget.email}" kullanıcısını silmek istediğinizden emin misiniz?`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
