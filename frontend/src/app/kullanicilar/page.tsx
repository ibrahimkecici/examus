'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';
import Modal, { ConfirmDialog } from '@/components/Modal';
import { apiFetch } from '@/lib/api';

type User = { id: string; email: string; firstName?: string; lastName?: string; role: string; createdAt: string };

const emptyForm = { email: '', firstName: '', lastName: '', password: '', role: 'ADMIN' };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const response = await apiFetch<User[]>('/users');
    setUsers(response.data);
  }

  useEffect(() => {
    apiFetch<User[]>('/users').then((response) => setUsers(response.data)).catch(console.error);
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
      const body: Record<string, string> = { email: form.email, firstName: form.firstName, lastName: form.lastName, role: form.role };
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
    setForm({ email: u.email, firstName: u.firstName || '', lastName: u.lastName || '', password: '', role: u.role });
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
        columns={['E-posta', 'Ad', 'Soyad', 'Rol']}
        rows={users.map((u) => [u.email, u.firstName || '-', u.lastName || '-', u.role])}
        onEdit={startEdit}
        onDelete={(i) => setDeleteTarget(users[i])}
      />

      {createOpen && (
        <Modal title="Yeni Kullanıcı" onClose={() => setCreateOpen(false)}>
          <form onSubmit={create} className="space-y-3">
            {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">{error}</p>}
            <div>
              <label className="mb-1 block text-xs text-slate-500">E-posta</label>
              <input required type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Ad</label>
                <input className={inputCls} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Soyad</label>
                <input className={inputCls} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Şifre</label>
              <input required type="password" className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Rol</label>
              <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="ADMIN">Admin</option>
                <option value="PLANNER">Planlayıcı</option>
                <option value="VIEWER">Görüntüleyici</option>
              </select>
            </div>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Ad</label>
                <input className={inputCls} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Soyad</label>
                <input className={inputCls} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Yeni Şifre (boş bırakılırsa değişmez)</label>
              <input type="password" className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Rol</label>
              <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="ADMIN">Admin</option>
                <option value="PLANNER">Planlayıcı</option>
                <option value="VIEWER">Görüntüleyici</option>
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
