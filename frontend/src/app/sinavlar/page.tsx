'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DataTable from '@/components/DataTable';
import StatusPill from '@/components/StatusPill';
import { ConfirmDialog } from '@/components/Modal';
import { apiFetch, formatDate } from '@/lib/api';
import { canManageResource, getStoredUser } from '@/lib/auth';

type Exam = {
  id: string; date?: string; startTime?: string; endTime?: string; status: string;
  course: { code: string; name: string; studentCount: number; instructorName?: string };
  roomAssignments?: Array<{ classroom: { name: string; code?: string }; assignedCount: number }>;
};

export default function SinavlarPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Exam | null>(null);
  const [user] = useState(() => getStoredUser());
  const canManage = canManageResource(user, 'exams');

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
        {canManage ? <Link href="/sinavlar/yeni" className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white">Yeni Sınav</Link> : null}
      </header>
      <DataTable
        columns={['Ders', 'Tarih', 'Saat', 'Salon', 'Öğrenci', 'Durum', '']}
        rows={exams.map((exam) => [
          <div key={exam.id}><p className="font-semibold">{exam.course.code}</p><p className="text-slate-500">{exam.course.name}</p></div>,
          formatDate(exam.date),
          exam.startTime ? `${exam.startTime}-${exam.endTime}` : '-',
          exam.roomAssignments?.length ? exam.roomAssignments.map((a) => a.classroom.name).join(', ') : '-',
          exam.course.studentCount,
          <StatusPill key={exam.id} tone={exam.status === 'PLANNED' ? 'green' : 'slate'}>{exam.status}</StatusPill>,
          <Link key={`detail-${exam.id}`} href={`/sinavlar/${exam.id}`} className="font-semibold text-blue-600 hover:underline">Detay</Link>,
        ])}
        onDelete={canManage ? (i) => setDeleteTarget(exams[i]) : undefined}
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
