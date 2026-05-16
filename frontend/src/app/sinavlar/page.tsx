'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DataTable from '@/components/DataTable';
import StatusPill from '@/components/StatusPill';
import { ConfirmDialog } from '@/components/Modal';
import { apiFetch, formatDate } from '@/lib/api';

type Exam = { id: string; date?: string; startTime?: string; endTime?: string; status: string; course: { code: string; name: string; studentCount: number; instructorName?: string } };

export default function SinavlarPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Exam | null>(null);

  async function load() {
    const response = await apiFetch<Exam[]>('/exams');
    setExams(response.data);
  }

  useEffect(() => {
    apiFetch<Exam[]>('/exams').then((response) => setExams(response.data)).catch(console.error);
  }, []);

  async function confirmDelete() {
    if (!deleteTarget) return;
    await apiFetch(`/exams/${deleteTarget.id}`, { method: 'DELETE' });
    setDeleteTarget(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Sınavlar</h2>
          <p className="text-slate-500">Planlanan oturumlar ve manuel sabitlemeler.</p>
        </div>
        <Link href="/sinavlar/yeni" className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white">Yeni Sınav</Link>
      </header>
      <DataTable
        columns={['Ders', 'Tarih', 'Saat', 'Öğrenci', 'Durum']}
        rows={exams.map((exam) => [
          <div key={exam.id}><p className="font-semibold">{exam.course.code}</p><p className="text-slate-500">{exam.course.name}</p></div>,
          formatDate(exam.date),
          exam.startTime ? `${exam.startTime}-${exam.endTime}` : '-',
          exam.course.studentCount,
          <StatusPill key={exam.id} tone={exam.status === 'PLANNED' ? 'green' : 'slate'}>{exam.status}</StatusPill>,
        ])}
        onEdit={(i) => { window.location.href = `/sinavlar/${exams[i].id}`; }}
        onDelete={(i) => setDeleteTarget(exams[i])}
      />

      {deleteTarget && (
        <ConfirmDialog
          message={`"${deleteTarget.course.code} — ${deleteTarget.course.name}" sınavını silmek istediğinizden emin misiniz?`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
