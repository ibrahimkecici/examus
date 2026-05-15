'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DataTable from '@/components/DataTable';
import StatusPill from '@/components/StatusPill';
import { apiFetch, formatDate, getApiBaseUrl, getToken } from '@/lib/api';

type Course = { code: string; name: string };
type Exam = { id: string; type: string; durationMinutes: number; course: Course };
type Period = { id: string; name: string; startDate: string; endDate: string };
type Schedule = { id: string; date: string; startTime: string; endTime: string; durationMinutes: number; examId: string };
type RoomSlot = {
  id: string; date: string; startTime: string; endTime: string;
  classroom: { id: string; code: string; name: string; capacity: number };
  assignments: Array<{ assignedCount: number; exam: Exam }>;
};
type SeatAssignment = {
  id: string;
  student: { id: string; fullName: string; studentNo: string; department: string };
  seat: { label: string; row: number; column: number };
  exam: Exam;
  classroom: { id: string; code: string; name: string; rowCount: number; columnCount: number };
};
type InvigilatorAssignment = {
  id: string; role: string;
  invigilator: { id: string; firstName: string; lastName: string; title: string };
  exam: Exam;
};
type Insight = { id: string; summary: string; risks: unknown; suggestions: unknown; createdAt: string };
type Warning = { code: string; message: string; severity: string };

type Scenario = {
  id: string; name: string; strategy: string; status: string; score: number;
  metrics?: Record<string, unknown>; warnings?: Warning[];
  createdAt: string; updatedAt: string;
  period: Period; schedules: Schedule[]; roomSlots: RoomSlot[];
  seats: SeatAssignment[]; invigilators: InvigilatorAssignment[]; insights: Insight[];
};

const STRATEGY_LABELS: Record<string, string> = {
  efficient: 'Verimli', compact: 'Kompakt', balanced: 'Dengeli',
  minimum_rooms: 'Minimum Derslik', fair_invigilator: 'Adil Gozetmen', student_friendly: 'Ogrenci Dostu',
};

const TABS = ['Ozet', 'Takvim', 'Derslikler', 'Gozetmenler'] as const;
type Tab = (typeof TABS)[number];

export default function ScenarioDetailPage() {
  const params = useParams<{ id: string }>();
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('Ozet');

  useEffect(() => {
    apiFetch<Scenario>(`/planning/scenarios/${params.id}`)
      .then((r) => setScenario(r.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Yuklenemedi.'));
  }, [params.id]);

  async function reload() {
    setError('');
    try {
      const r = await apiFetch<Scenario>(`/planning/scenarios/${params.id}`);
      setScenario(r.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yuklenemedi.');
    }
  }

  async function run() { await apiFetch(`/planning/scenarios/${params.id}/run`, { method: 'POST' }); await reload(); }
  async function recheck() { await apiFetch(`/planning/scenarios/${params.id}/recheck`, { method: 'POST' }); await reload(); }
  async function approve() { await apiFetch(`/planning/scenarios/${params.id}/approve`, { method: 'POST' }); await reload(); }
  async function generateInsight() { await apiFetch(`/ai/scenarios/${params.id}/insights`, { method: 'POST' }); await reload(); }

  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!scenario) return <div className="p-6">Yukleniyor...</div>;

  const roomSlotsByDate = groupSlotsByDate(scenario.roomSlots);
  const seatSlotsByClassroom = groupSeatsByClassroom(scenario.seats);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-4">
        <Link href="/planlama" className="rounded-md border px-3 py-2 text-sm">Geri</Link>
        <div className="min-w-0">
          <h2 className="text-2xl font-bold truncate">{scenario.name}</h2>
          <p className="text-sm text-slate-500">{scenario.period.name} &middot; {STRATEGY_LABELS[scenario.strategy] || scenario.strategy}</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InfoCard label="Durum"><StatusPill tone={scenario.status === 'APPROVED' ? 'green' : scenario.status === 'COMPLETED' ? 'blue' : scenario.status === 'FAILED' ? 'rose' : 'slate'}>{scenario.status}</StatusPill></InfoCard>
        <InfoCard label="Skor" value={Math.round(scenario.score)} />
        <InfoCard label="Strateji" value={STRATEGY_LABELS[scenario.strategy] || scenario.strategy} />
        <InfoCard label="Guncelleme" value={formatDate(scenario.updatedAt)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={run} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Calistir</button>
        <button onClick={recheck} className="rounded-md border px-3 py-2 text-sm">Tekrar Kontrol Et</button>
        <button onClick={approve} disabled={scenario.status === 'APPROVED'} className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Onayla</button>
        <button onClick={generateInsight} className="rounded-md border px-3 py-2 text-sm">AI Onerisi Uret</button>
        <a href={`${getApiBaseUrl()}/reports/scenarios/${scenario.id}/calendar.xlsx?token=${getToken()}`} className="rounded-md border px-3 py-2 text-sm">Takvim (Excel)</a>
        <a href={`${getApiBaseUrl()}/reports/scenarios/${scenario.id}/calendar.pdf?token=${getToken()}`} className="rounded-md border px-3 py-2 text-sm">Takvim (PDF)</a>
      </div>

      <nav className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab}
            {tab === 'Derslikler' && scenario.roomSlots.length > 0 && (
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">{scenario.roomSlots.length}</span>
            )}
            {tab === 'Gozetmenler' && scenario.invigilators.length > 0 && (
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">{scenario.invigilators.length}</span>
            )}
          </button>
        ))}
      </nav>

      {activeTab === 'Ozet' && <OverviewTab scenario={scenario} />}
      {activeTab === 'Takvim' && <ScheduleTab schedules={scenario.schedules} />}
      {activeTab === 'Derslikler' && <ClassroomTab roomSlotsByDate={roomSlotsByDate} seatSlotsByClassroom={seatSlotsByClassroom} />}
      {activeTab === 'Gozetmenler' && <InvigilatorTab invigilators={scenario.invigilators} />}
    </div>
  );
}

function OverviewTab({ scenario }: { scenario: Scenario }) {
  const totalStudents = scenario.seats.length;
  const totalExams = new Set(scenario.schedules.map((s) => s.examId)).size;
  const totalRooms = scenario.roomSlots.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <InfoCard label="Toplam Sinav" value={totalExams || '-'} />
        <InfoCard label="Atanmis Ogrenci" value={totalStudents || '-'} />
        <InfoCard label="Kullanilan Derslik" value={totalRooms || '-'} />
      </div>

      {scenario.warnings && scenario.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <h3 className="mb-2 font-semibold text-amber-700 dark:text-amber-400">Uyarilar ({scenario.warnings.length})</h3>
          <ul className="space-y-1">
            {scenario.warnings.map((w, i) => (
              <li key={i} className="text-sm text-amber-800 dark:text-amber-300">
                <span className="font-mono text-xs opacity-60">[{w.code}]</span> {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {scenario.insights.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">AI Onerileri ({scenario.insights.length})</h3>
          {scenario.insights.map((insight) => (
            <div key={insight.id} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs text-slate-400">{formatDate(insight.createdAt)}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{insight.summary}</p>
              {insight.risks && <p className="mt-1 text-xs text-amber-600">Riskler: {JSON.stringify(insight.risks)}</p>}
              {insight.suggestions && <p className="mt-1 text-xs text-green-600">Oneriler: {JSON.stringify(insight.suggestions)}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduleTab({ schedules }: { schedules: Schedule[] }) {
  if (schedules.length === 0) return <p className="text-slate-500">Henuz takvim olusturulmadi.</p>;
  const sorted = [...schedules].sort((a, b) => {
    const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.startTime.localeCompare(b.startTime);
  });
  return (
    <DataTable
      columns={['Tarih', 'Baslangic', 'Bitis', 'Sure (dk)']}
      rows={sorted.map((s) => [formatDate(s.date), s.startTime, s.endTime, s.durationMinutes])}
    />
  );
}

function ClassroomTab({
  roomSlotsByDate,
  seatSlotsByClassroom,
}: {
  roomSlotsByDate: Record<string, RoomSlot[]>;
  seatSlotsByClassroom: Record<string, SeatAssignment[]>;
}) {
  if (Object.keys(roomSlotsByDate).length === 0) return <p className="text-slate-500">Henuz derslik atamasi yapilmadi.</p>;

  return (
    <div className="space-y-8">
      {Object.entries(roomSlotsByDate).map(([date, slots]) => (
        <div key={date}>
          <h3 className="mb-3 text-sm font-semibold text-slate-500">{formatDate(date)}</h3>
          <div className="space-y-6">
            {slots.map((slot) => {
              const classroomId = slot.classroom.id;
              const slotExamIds = new Set(slot.assignments.map((a) => a.exam.id));
              const allClassroomSeats = seatSlotsByClassroom[classroomId] || [];
              const slotSeats = allClassroomSeats.filter((s) => slotExamIds.has(s.exam.id));

              const uniqueCourseCodes = [...new Set(slotSeats.map((s) => s.exam.course.code))];
              const colorByCourse = new Map(uniqueCourseCodes.map((code, i) => [code, i % COURSE_COLORS.length]));

              return (
                <div key={slot.id} className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{slot.classroom.name} <span className="font-mono text-sm text-slate-400">({slot.classroom.code})</span></p>
                      <p className="text-sm text-slate-500">{slot.startTime} &ndash; {slot.endTime} &middot; K: {slot.classroom.capacity}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      {slot.assignments.map((a) => {
                        const cIdx = colorByCourse.get(a.exam.course.code);
                        return (
                          <span key={a.exam.id} className={cIdx !== undefined ? `${COURSE_COLORS[cIdx].text} font-medium` : 'text-slate-500'}>
                            {a.exam.course.code} ({a.assignedCount})
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  {slotSeats.length > 0 && <SeatGrid seats={slotSeats} colorByCourse={colorByCourse} />}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SeatGrid({ seats, colorByCourse }: { seats: SeatAssignment[]; colorByCourse: Map<string, number> }) {
  const maxRow = Math.max(...seats.map((s) => s.seat.row), 0);
  const maxCol = Math.max(...seats.map((s) => s.seat.column), 0);
  if (maxRow === 0 || maxCol === 0) return null;

  const uniqueCourseCodes = [...new Set(seats.map((s) => s.exam.course.code))];

  const seatByPos = new Map<string, SeatAssignment>();
  for (const s of seats) {
    seatByPos.set(`${s.seat.row}-${s.seat.column}`, s);
  }

  const grid = Array.from({ length: maxRow }, (_, ri) =>
    Array.from({ length: maxCol }, (_, ci) => seatByPos.get(`${ri + 1}-${ci + 1}`) || null),
  );

  return (
    <div className="mt-4 overflow-x-auto">
      {uniqueCourseCodes.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-3 text-xs">
          {uniqueCourseCodes.map((code) => {
            const ci = colorByCourse.get(code) ?? 0;
            return (
              <div key={code} className="flex items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${COURSE_COLORS[ci].dot}`} />
                <span className="text-slate-500">{code}</span>
              </div>
            );
          })}
        </div>
      )}
      <div
        className="mx-auto grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${maxCol}, minmax(52px, 1fr))`, maxWidth: maxCol * 76 }}
      >
        {grid.flat().map((s, i) => {
          if (!s) {
            return (
              <div key={i} className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-slate-200 text-xs text-slate-300 dark:border-slate-700 dark:text-slate-600" />
            );
          }
          const colorIdx = colorByCourse.get(s.exam.course.code) ?? 0;
          const colors = COURSE_COLORS[colorIdx];
          return (
            <div
              key={`${s.seat.row}-${s.seat.column}`}
              className={`group relative flex h-12 w-12 flex-col items-center justify-center rounded-md border text-center ${colors.border} ${colors.bg}`}
            >
              <span className={`text-[10px] font-bold ${colors.text}`}>
                {s.student.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </span>
              <span className="text-[9px] opacity-50">{s.seat.label}</span>
              <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2.5 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 z-20 shadow-lg">
                <p className="font-semibold">{s.student.fullName}</p>
                <p className="text-slate-300">{s.student.studentNo}</p>
                <p className="text-slate-400">{s.exam.course.code} {s.exam.course.name}</p>
                <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const COURSE_COLORS = [
  { dot: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300' },
  { dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300' },
  { dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300' },
  { dot: 'bg-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/40', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-700 dark:text-purple-300' },
  { dot: 'bg-rose-500', bg: 'bg-rose-50 dark:bg-rose-950/40', border: 'border-rose-200 dark:border-rose-800', text: 'text-rose-700 dark:text-rose-300' },
  { dot: 'bg-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-950/40', border: 'border-cyan-200 dark:border-cyan-800', text: 'text-cyan-700 dark:text-cyan-300' },
  { dot: 'bg-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-300' },
  { dot: 'bg-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-950/40', border: 'border-indigo-200 dark:border-indigo-800', text: 'text-indigo-700 dark:text-indigo-300' },
];

function InvigilatorTab({ invigilators }: { invigilators: InvigilatorAssignment[] }) {
  if (invigilators.length === 0) return <p className="text-slate-500">Henuz gozetmen atamasi yapilmadi.</p>;
  return (
    <DataTable
      columns={['Gozetmen', 'Unvan', 'Ders', 'Rol']}
      rows={invigilators.map((a) => [
        `${a.invigilator.firstName} ${a.invigilator.lastName}`,
        a.invigilator.title,
        `${a.exam.course.code} - ${a.exam.course.name}`,
        a.role,
      ])}
    />
  );
}

function InfoCard({ label, value, children }: { label: string; value?: string | number; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-500">{label}</p>
      {children || <p className="mt-1 text-xl font-semibold">{value}</p>}
    </div>
  );
}

function groupSlotsByDate(slots: RoomSlot[]): Record<string, RoomSlot[]> {
  const groups: Record<string, RoomSlot[]> = {};
  for (const slot of slots) {
    const key = slot.date;
    if (!groups[key]) groups[key] = [];
    groups[key].push(slot);
  }
  const sorted: Record<string, RoomSlot[]> = {};
  for (const key of Object.keys(groups).sort()) sorted[key] = groups[key];
  return sorted;
}

function groupSeatsByClassroom(seats: SeatAssignment[]): Record<string, SeatAssignment[]> {
  const groups: Record<string, SeatAssignment[]> = {};
  for (const seat of seats) {
    const classroomId = seat.classroom?.id;
    if (!classroomId) continue;
    if (!groups[classroomId]) groups[classroomId] = [];
    groups[classroomId].push(seat);
  }
  return groups;
}
