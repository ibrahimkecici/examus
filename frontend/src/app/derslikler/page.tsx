'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DataTable from '@/components/DataTable';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

type Classroom = { id: string; code: string; name: string; building?: string; floor?: string; capacity: number; rowCount: number; columnCount: number };

export default function DersliklerPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [user] = useState(() => getStoredUser());
  const canManage = user?.role === 'ADMIN';

  useEffect(() => {
    apiFetch<Classroom[]>('/classrooms').then((response) => setClassrooms(response.data)).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Derslik Yönetimi</h2>
          <p className="text-slate-500">Sınıf planları, kapasite ve sıra düzenleri.</p>
        </div>
        {canManage ? <Link href="/derslikler/yeni" className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white">Derslik Oluştur</Link> : null}
      </header>
      <DataTable
        columns={['Kod', 'Ad', 'Bina', 'Kapasite', 'Düzen', 'İşlem']}
        rows={classrooms.map((classroom) => [
          classroom.code,
          classroom.name,
          [classroom.building, classroom.floor].filter(Boolean).join(' / ') || '-',
          classroom.capacity,
          `${classroom.rowCount} x ${classroom.columnCount}`,
          <Link key={classroom.id} href={`/derslikler/${classroom.id}`} className="font-semibold text-blue-600">Detay</Link>,
        ])}
      />
    </div>
  );
}
