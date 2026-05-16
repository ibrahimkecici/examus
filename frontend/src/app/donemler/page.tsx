'use client';

import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';
import Modal, { ConfirmDialog } from '@/components/Modal';
import { apiFetch, formatDate } from '@/lib/api';

type Period = { id: string; name: string; startDate: string; endDate: string; status: string; exams: unknown[]; scenarios: unknown[] };

const emptyForm = { name: '', startDate: '', endDate: '' };

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editTarget, setEditTarget] = useState<Period | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Period | null>(null);

  async function load() {
    const response = await apiFetch<Period[]>('/exam-periods');
    setPeriods(response.data);
  }

  useEffect(() => {
    apiFetch<Period[]>('/exam-periods').then((response) => setPeriods(response.data)).catch(console.error);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await apiFetch('/exam-periods', {
      method: 'POST',
      body: JSON.stringify({ ...form, slots: [{ startTime: '09:00', endTime: '11:00' }, { startTime: '12:00', endTime: '14:00' }, { startTime: '15:00', endTime: '17:00' }] }),
    });
    setForm(emptyForm);
    await load();
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editTarget) return;
    await apiFetch(`/exam-periods/${editTarget.id}`, { method: 'PUT', body: JSON.stringify(form) });
    setEditTarget(null);
    await load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await apiFetch(`/exam-periods/${deleteTarget.id}`, { method: 'DELETE' });
    setDeleteTarget(null);
    await load();
  }

  function startEdit(index: number) {
    const p = periods[index];
    setForm({
      name: p.name,
      startDate: p.startDate.slice(0, 10),
      endDate: p.endDate.slice(0, 10),
    });
    setEditTarget(p);
  }

  const inputCls = 'rounded-md border px-3 py-2 text-sm w-full dark:border-slate-700 dark:bg-slate-950';

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold">Sınav Dönemleri</h2>
        <p className="text-slate-500">Tarih aralığı ve günlük slot tanımları.</p>
      </header>

      <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-4">
        <input required placeholder="Dönem adı" className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input required type="date" className={inputCls} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        <input required type="date" className={inputCls} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        <button className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">Dönem Oluştur</button>
      </form>

      <DataTable
        columns={['Ad', 'Başlangıç', 'Bitiş', 'Durum', 'Sınav', 'Senaryo']}
        rows={periods.map((p) => [p.name, formatDate(p.startDate), formatDate(p.endDate), p.status, (p.exams as unknown[]).length, (p.scenarios as unknown[]).length])}
        onEdit={startEdit}
        onDelete={(i) => setDeleteTarget(periods[i])}
      />

      {editTarget && (
        <Modal title={`Dönemi Düzenle — ${editTarget.name}`} onClose={() => setEditTarget(null)}>
          <form onSubmit={saveEdit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Dönem Adı</label>
              <input required className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Başlangıç</label>
                <input required type="date" className={inputCls} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Bitiş</label>
                <input required type="date" className={inputCls} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
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
          message={`"${deleteTarget.name}" dönemini ve içindeki tüm sınavları silmek istediğinizden emin misiniz?`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
