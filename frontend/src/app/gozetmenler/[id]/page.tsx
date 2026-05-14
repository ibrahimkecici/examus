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

  useEffect(() => {
    apiFetch<Invigilator>(`/invigilators/${params.id}`).then((response) => setItem(response.data)).catch(console.error);
  }, [params.id]);

  if (!item) return <div>Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Link href="/gozetmenler" className="rounded-md border px-3 py-2">Geri</Link>
        <div>
          <p className="font-mono text-sm text-blue-600">{item.staffNo}</p>
          <h2 className="text-3xl font-bold">{item.title ? `${item.title} ` : ''}{item.firstName} {item.lastName}</h2>
          <p className="text-slate-500">{item.department || 'Bölüm bilgisi yok'}</p>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Info title="E-posta" value={item.email || '-'} />
        <Info title="Telefon" value={item.phone || '-'} />
        <Info title="Maksimum Görev" value={String(item.maxAssignments)} />
      </div>
      <DataTable columns={['Görevli Ders']} rows={item.assignments.map((assignment) => [assignment.exam?.course ? `${assignment.exam.course.code} - ${assignment.exam.course.name}` : '-'])} emptyText="Henüz görev ataması yok." />
    </div>
  );
}

function Info({ title, value }: { title: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 font-semibold">{value}</p></div>;
}
