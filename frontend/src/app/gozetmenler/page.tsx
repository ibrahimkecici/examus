'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DataTable from '@/components/DataTable';
import { apiFetch } from '@/lib/api';

type Invigilator = { id: string; staffNo: string; firstName: string; lastName: string; title?: string; department?: string; email?: string; maxAssignments: number };

export default function GozetmenlerPage() {
  const [items, setItems] = useState<Invigilator[]>([]);

  useEffect(() => {
    apiFetch<Invigilator[]>('/invigilators').then((response) => setItems(response.data)).catch(console.error);
  }, []);

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
      />
    </div>
  );
}
