'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DataTable from '@/components/DataTable';
import { apiFetch } from '@/lib/api';

type Invigilator = {
  id: string;
  staffNo: string;
  firstName: string;
  lastName: string;
  title?: string;
  email?: string;
  phone?: string;
  department?: string;
  maxAssignments: number;
  assignments: Array<{ exam?: { course?: { code: string; name: string } } }>;
};

export default function GozetmenDetay() {
  const params = useParams<{ id: string }>();
  const [item, setItem] = useState<Invigilator | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ staffNo: '', firstName: '', lastName: '', title: '', email: '', phone: '', department: '', maxAssignments: '4' });
  const [saving, setSaving] = useState(false);

  async function load() {
    const r = await apiFetch<Invigilator>(`/invigilators/${params.id}`);
    setItem(r.data);
    setForm({
      staffNo: r.data.staffNo,
      firstName: r.data.firstName,
      lastName: r.data.lastName,
      title: r.data.title || '',
      email: r.data.email || '',
      phone: r.data.phone || '',
      department: r.data.department || '',
      maxAssignments: String(r.data.maxAssignments),
    });
  }

  useEffect(() => {
    apiFetch<Invigilator>(`/invigilators/${params.id}`).then((r) => {
      setItem(r.data);
      setForm({
        staffNo: r.data.staffNo,
        firstName: r.data.firstName,
        lastName: r.data.lastName,
        title: r.data.title || '',
        email: r.data.email || '',
        phone: r.data.phone || '',
        department: r.data.department || '',
        maxAssignments: String(r.data.maxAssignments),
      });
    }).catch(console.error);
  }, [params.id]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/invigilators/${params.id}`, { method: 'PUT', body: JSON.stringify({ ...form, maxAssignments: Number(form.maxAssignments) }) });
      await load();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!item) return <div className="p-8 text-slate-500">Yükleniyor...</div>;

  const inputCls = 'rounded-md border px-3 py-2 text-sm w-full dark:border-slate-700 dark:bg-slate-950';

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Link href="/gozetmenler" className="rounded-md border px-3 py-2 text-sm">Geri</Link>
        <div className="flex-1">
          <p className="font-mono text-sm text-blue-600">{item.staffNo}</p>
          <h2 className="text-3xl font-bold">{item.title ? `${item.title} ` : ''}{item.firstName} {item.lastName}</h2>
          <p className="text-slate-500">{item.department || 'Bölüm bilgisi yok'}</p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">Düzenle</button>
        )}
      </header>

      {editing ? (
        <form onSubmit={save} className="space-y-3 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Ad</label>
              <input required className={inputCls} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Soyad</label>
              <input required className={inputCls} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Sicil No</label>
              <input required className={inputCls} value={form.staffNo} onChange={(e) => setForm({ ...form, staffNo: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Unvan</label>
              <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">E-posta</label>
              <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Telefon</label>
              <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Bölüm</label>
              <input className={inputCls} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Maks. Görev</label>
              <input type="number" min="1" className={inputCls} value={form.maxAssignments} onChange={(e) => setForm({ ...form, maxAssignments: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-md border px-4 py-2 text-sm dark:border-slate-700">İptal</button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Info title="E-posta" value={item.email || '-'} />
          <Info title="Telefon" value={item.phone || '-'} />
          <Info title="Maksimum Görev" value={String(item.maxAssignments)} />
        </div>
      )}

      <DataTable
        columns={['Görevli Ders']}
        rows={item.assignments.map((a) => [a.exam?.course ? `${a.exam.course.code} - ${a.exam.course.name}` : '-'])}
        emptyText="Henüz görev ataması yok."
      />
    </div>
  );
}

function Info({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}
