'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DataTable from '@/components/DataTable';
import { apiFetch, formatDate } from '@/lib/api';

type Exam = {
  id: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  status: string;
  course: { code: string; name: string; instructorName?: string; studentCount: number };
  roomAssignments: Array<{ classroom: { name: string; capacity: number }; assignedCount: number }>;
};

export default function SinavDetay() {
  const params = useParams<{ id: string }>();
  const [exam, setExam] = useState<Exam | null>(null);

  useEffect(() => {
    apiFetch<Exam>(`/exams/${params.id}`).then((response) => setExam(response.data)).catch(console.error);
  }, [params.id]);

  if (!exam) return <div>Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Link href="/sinavlar" className="rounded-md border px-3 py-2">Geri</Link>
        <div>
          <p className="font-mono text-sm text-blue-600">{exam.course.code}</p>
          <h2 className="text-3xl font-bold">{exam.course.name}</h2>
          <p className="text-slate-500">{formatDate(exam.date)} {exam.startTime ? `${exam.startTime}-${exam.endTime}` : ''}</p>
        </div>
      </header>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Info title="Öğretim Elemanı" value={exam.course.instructorName || '-'} />
        <Info title="Öğrenci" value={String(exam.course.studentCount)} />
        <Info title="Durum" value={exam.status} />
      </section>
      <DataTable
        columns={['Derslik', 'Kapasite', 'Atanan']}
        rows={exam.roomAssignments.map((assignment) => [assignment.classroom.name, assignment.classroom.capacity, assignment.assignedCount])}
        emptyText="Bu sınav henüz bir senaryoda salona atanmadı."
      />
    </div>
  );
}

function Info({ title, value }: { title: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 font-semibold">{value}</p></div>;
}
