'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ClassroomLayout from '@/components/ClassroomLayout';
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
  const [classroom, setClassroom] = useState<Classroom | null>(null);

  useEffect(() => {
    apiFetch<Classroom>(`/classrooms/${params.id}`).then((response) => setClassroom(response.data)).catch(console.error);
  }, [params.id]);

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

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Link href="/derslikler" className="rounded-md border px-3 py-2">Geri</Link>
        <div>
          <p className="font-mono text-sm text-blue-600">{classroom.code}</p>
          <h2 className="text-3xl font-bold">{classroom.name}</h2>
          <p className="text-slate-500">{classroom.building || 'Bina bilgisi yok'}</p>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Info title="Toplam Kapasite" value={`${classroom.capacity}`} />
        <Info title="Aktif Sıra" value={`${stats.aktifSira}`} />
        <Info title="Pasif/Boşluk" value={`${stats.pasifSira + stats.boslukSayisi}`} />
      </div>
      <ClassroomLayout layout={layout} />
    </div>
  );
}

function Info({ title, value }: { title: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>;
}
