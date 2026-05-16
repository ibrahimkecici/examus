'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import ClassroomLayout from '@/components/ClassroomLayout';
import Modal, { ConfirmDialog } from '@/components/Modal';
import { apiFetch } from '@/lib/api';
import { ClassroomLayoutPlan, getLayoutStats } from '@/lib/classroom-layout';

type Classroom = {
  id: string;
  code: string;
  name: string;
  building?: string;
  capacity: number;
  rowCount: number;
  columnCount: number;
  seats: Array<{ label: string; row: number; column: number; status: 'AKTIF' | 'PASIF' | 'BOSLUK'; capacity: number }>;
};

export default function DerslikDetay() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', building: '', capacity: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Classroom>(`/classrooms/${params.id}`).then((response) => {
      setClassroom(response.data);
      setEditForm({ name: response.data.name, building: response.data.building || '', capacity: String(response.data.capacity) });
    }).catch(console.error);
  }, [params.id]);

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!classroom) return;
    setSaving(true);
    try {
      const updated = await apiFetch<Classroom>(`/classrooms/${classroom.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editForm.name, building: editForm.building, capacity: Number(editForm.capacity) }),
      });
      setClassroom(updated.data);
      setEditOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!classroom) return;
    await apiFetch(`/classrooms/${classroom.id}`, { method: 'DELETE' });
    router.push('/derslikler');
  }

  const layout = useMemo<ClassroomLayoutPlan | null>(() => {
    if (!classroom) return null;
    return {
      satirSayisi: classroom.rowCount,
      sutunSayisi: classroom.columnCount,
      siralar: classroom.seats.map((seat) => ({
        siraNo: seat.label,
        satir: seat.row,
        sutun: seat.column,
        durum: seat.status === 'PASIF' ? 'Pasif' : seat.status === 'BOSLUK' ? 'Boşluk' : 'Aktif',
        kapasite: seat.capacity,
      })),
    };
  }, [classroom]);

  if (!classroom || !layout) return <div>Yükleniyor...</div>;
  const stats = getLayoutStats(layout);
  const inputCls = 'rounded-md border px-3 py-2 text-sm w-full dark:border-slate-700 dark:bg-slate-950';

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Link href="/derslikler" className="rounded-md border px-3 py-2">Geri</Link>
        <div className="flex-1">
          <p className="font-mono text-sm text-blue-600">{classroom.code}</p>
          <h2 className="text-3xl font-bold">{classroom.name}</h2>
          <p className="text-slate-500">{classroom.building || 'Bina bilgisi yok'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditOpen(true)} className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-900">Düzenle</button>
          <button onClick={() => setDeleteOpen(true)} className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950">Sil</button>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Info title="Toplam Kapasite" value={`${classroom.capacity}`} />
        <Info title="Aktif Sıra" value={`${stats.aktifSira}`} />
        <Info title="Pasif/Boşluk" value={`${stats.pasifSira + stats.boslukSayisi}`} />
      </div>
      <ClassroomLayout layout={layout} />

      {editOpen && (
        <Modal title="Dersliği Düzenle" onClose={() => setEditOpen(false)}>
          <form onSubmit={saveEdit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Ad</label>
              <input required className={inputCls} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Bina</label>
              <input className={inputCls} value={editForm.building} onChange={(e) => setEditForm({ ...editForm, building: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Kapasite</label>
              <input required type="number" min="1" className={inputCls} value={editForm.capacity} onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditOpen(false)} className="rounded-md border px-4 py-2 text-sm dark:border-slate-700">İptal</button>
              <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteOpen && (
        <ConfirmDialog
          message={`"${classroom.name}" dersliğini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteOpen(false)}
        />
      )}
    </div>
  );
}

function Info({ title, value }: { title: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>;
}
