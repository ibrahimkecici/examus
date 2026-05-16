'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DataTable from '@/components/DataTable';
import { ConfirmDialog } from '@/components/Modal';
import { apiFetch } from '@/lib/api';

type Invigilator = { id: string; staffNo: string; firstName: string; lastName: string; title?: string; department?: string; email?: string; maxAssignments: number };

export default function GozetmenlerPage() {
  const [items, setItems] = useState<Invigilator[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Invigilator | null>(null);

  async function load() {
    const response = await apiFetch<Invigilator[]>('/invigilators');
    setItems(response.data);
  }

  useEffect(() => {
    apiFetch<Invigilator[]>('/invigilators').then((response) => setItems(response.data)).catch(console.error);
  }, []);

  async function confirmDelete() {
    if (!deleteTarget) return;
    await apiFetch(`/invigilators/${deleteTarget.id}`, { method: 'DELETE' });
    setDeleteTarget(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Gözetmenler</h2>
          <p className="text-slate-500">Görev kapasitesi ve bölüm bilgileri.</p>
        </div>
        <Link href="/gozetmenler/yeni" className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white">Yeni Gözetmen</Link>
      </header>
      <DataTable
        columns={['Sicil', 'Ad Soyad', 'Unvan', 'Bölüm', 'Maks. Görev', 'İletişim']}
        rows={items.map((item) => [item.staffNo, `${item.firstName} ${item.lastName}`, item.title || '-', item.department || '-', item.maxAssignments, item.email || '-'])}
        onEdit={(i) => { window.location.href = `/gozetmenler/${items[i].id}`; }}
        onDelete={(i) => setDeleteTarget(items[i])}
      />

      {deleteTarget && (
        <ConfirmDialog
          message={`"${deleteTarget.firstName} ${deleteTarget.lastName}" gözetmenini silmek istediğinizden emin misiniz?`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
