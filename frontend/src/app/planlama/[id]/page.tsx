'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import StatusPill from '@/components/StatusPill';
import { apiFetch, formatDate, getApiBaseUrl, getToken } from '@/lib/api';
import { CurrentUser, getStoredUser } from '@/lib/auth';
import { getRoleReportExports } from '@/lib/reportExports';

type Course = { code: string; name: string };
type Exam = { id: string; type: string; durationMinutes: number; course: Course };
type Period = { id: string; name: string; startDate: string; endDate: string };
type Schedule = { id: string; date: string; startTime: string; endTime: string; durationMinutes: number; examId: string; exam: Exam };
type ClassroomResource = { id: string; code: string; name: string; capacity: number; examCapacity?: number | null };
type InvigilatorResource = { id: string; firstName: string; lastName: string; title?: string | null };
type ClassroomSeat = { id: string; label: string; row: number; column: number; status: string };
type RoomSlot = {
  id: string; date: string; startTime: string; endTime: string;
  classroom: { id: string; code: string; name: string; capacity: number; rowCount: number; columnCount: number };
  assignments: Array<{ id: string; classroomId: string; assignedCount: number; exam: Exam }>;
};
type SeatAssignment = {
  id: string;
  seatId: string;
  locked?: boolean;
  student: { id: string; fullName: string; studentNo: string; department: string };
  seat: { label: string; row: number; column: number };
  exam: Exam;
  bookletType?: string | null;
  classroom: { id: string; code: string; name: string; rowCount: number; columnCount: number; seats?: ClassroomSeat[] };
};
type InvigilatorAssignment = {
  id: string; role: string;
  invigilator: { id: string; firstName: string; lastName: string; title: string };
  exam: Exam;
};
type Insight = { id: string; provider?: string | null; model?: string | null; summary: string; risks: unknown; suggestions: unknown; createdAt: string };
type Warning = { code: string; message: string; severity: string };

type ExamCoverageEntry = { examId: string; courseCode: string; expected: number; actual: number; missing: number; extra: number };
type Metrics = {
  totalExpectedStudents?: number;
  totalAssignedStudents?: number;
  unassignedStudentCount?: number;
  examCoveragePercent?: number;
  examCoverage?: ExamCoverageEntry[];
  [key: string]: unknown;
};
type ScenarioComparison = {
  previous: { id: string; name: string; status: string; strategy: string; score: number; createdAt: string; approvedAt?: string | null } | null;
  metrics: Record<string, number | null>;
  previousMetrics?: Record<string, number | null>;
  deltas: Record<string, number | null> | null;
};
type ValidationResult = { ok: boolean; hard: Array<{ code: string; message: string }>; soft: Array<{ code: string; message: string }>; summary?: Record<string, unknown> };
type EditTarget =
  | { kind: 'schedule'; schedule: Schedule }
  | { kind: 'room'; slot: RoomSlot; assignment: RoomSlot['assignments'][number] }
  | { kind: 'seat'; assignment: SeatAssignment }
  | { kind: 'invigilator'; assignment: InvigilatorAssignment };

type Scenario = {
  id: string; name: string; strategy: string; status: string; score: number;
  metrics?: Metrics; warnings?: Warning[];
  createdAt: string; updatedAt: string;
  period: Period; schedules: Schedule[]; roomSlots: RoomSlot[];
  seats: SeatAssignment[]; invigilators: InvigilatorAssignment[]; insights: Insight[];
};

const STRATEGY_LABELS: Record<string, string> = {
  optimal_cp_sat: 'Kesin Optimizasyon',
  efficient: 'Verimli', compact: 'Kompakt', balanced: 'Dengeli',
  minimum_rooms: 'Minimum Derslik', fair_invigilator: 'Adil Gözetmen', student_friendly: 'Öğrenci Dostu',
  heuristic: 'Eski Heuristik',
};

const TABS = ['Özet', 'Takvim', 'Derslikler', 'Gözetmenler'] as const;
type Tab = (typeof TABS)[number];

export default function ScenarioDetailPage() {
  const params = useParams<{ id: string }>();
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('Özet');
  const [running, setRunning] = useState(false);
  const [actionError, setActionError] = useState('');
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [comparison, setComparison] = useState<ScenarioComparison | null>(null);
  const [classrooms, setClassrooms] = useState<ClassroomResource[]>([]);
  const [invigilators, setInvigilators] = useState<InvigilatorResource[]>([]);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [deletingInsightId, setDeletingInsightId] = useState<string | null>(null);
  const isAdmin = user?.role === 'ADMIN';
  const canManageAi = user?.role === 'ADMIN' || user?.role === 'DEPARTMENT_MANAGER';
  const canManualEdit = user?.role === 'ADMIN' || user?.role === 'DEPARTMENT_MANAGER';
  const canEditSchedule = canManualEdit || user?.role === 'INSTRUCTOR';

  useEffect(() => {
    const storedUser = getStoredUser();
    setUser(storedUser);
    apiFetch<Scenario>(`/planning/scenarios/${params.id}`)
      .then((r) => setScenario(r.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Yüklenemedi.'));
    apiFetch<ScenarioComparison>(`/planning/scenarios/${params.id}/comparison`)
      .then((r) => setComparison(r.data))
      .catch(() => setComparison(null));
    if (storedUser?.role === 'ADMIN' || storedUser?.role === 'DEPARTMENT_MANAGER') {
      Promise.all([apiFetch<ClassroomResource[]>('/classrooms'), apiFetch<InvigilatorResource[]>('/invigilators')])
        .then(([classroomResponse, invigilatorResponse]) => {
          setClassrooms(classroomResponse.data);
          setInvigilators(invigilatorResponse.data);
        })
        .catch(console.error);
    }
  }, [params.id]);

  async function reload() {
    setError('');
    try {
      const r = await apiFetch<Scenario>(`/planning/scenarios/${params.id}`);
      setScenario(r.data);
      apiFetch<ScenarioComparison>(`/planning/scenarios/${params.id}/comparison`).then((response) => setComparison(response.data)).catch(() => setComparison(null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi.');
    }
  }

  async function run() {
    if (running) return;
    setActionError('');
    setRunning(true);
    try {
      await apiFetch(`/planning/scenarios/${params.id}/run`, { method: 'POST' });
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Planlama çalıştırılamadı.');
      await reload();
    } finally {
      setRunning(false);
    }
  }
  async function recheck() { await apiFetch(`/planning/scenarios/${params.id}/recheck`, { method: 'POST' }); await reload(); }
  async function approve() { await apiFetch(`/planning/scenarios/${params.id}/approve`, { method: 'POST' }); await reload(); }
  async function generateInsight() {
    if (aiBusy) return;
    setAiBusy(true);
    setAiMessage('AI isteği gönderiliyor. Model yanıtı bekleniyor...');
    try {
      const response = await apiFetch<Insight>(`/ai/scenarios/${params.id}/insights`, { method: 'POST' });
      setAiMessage(`AI önerisi alındı: ${response.data.provider || 'heuristic'}${response.data.model ? ` / ${response.data.model}` : ''}`);
      await reload();
    } catch (err) {
      setAiMessage(err instanceof Error ? err.message : 'AI önerisi alınamadı.');
    } finally {
      setAiBusy(false);
    }
  }

  async function deleteInsight(id: string) {
    if (!confirm('Bu AI önerisi silinsin mi?')) return;
    setDeletingInsightId(id);
    setAiMessage('');
    try {
      await apiFetch(`/ai/insights/${id}`, { method: 'DELETE' });
      setAiMessage('AI önerisi silindi.');
      await reload();
    } catch (err) {
      setAiMessage(err instanceof Error ? err.message : 'AI önerisi silinemedi.');
    } finally {
      setDeletingInsightId(null);
    }
  }

  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!scenario) return <div className="p-6">Yükleniyor...</div>;

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
        <InfoCard label="Güncelleme" value={formatDate(scenario.updatedAt)} />
      </div>

      {isAdmin ? (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={run}
            disabled={running}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? 'Çalışıyor…' : 'Çalıştır'}
          </button>
          <button onClick={recheck} disabled={running} className="rounded-md border px-3 py-2 text-sm disabled:opacity-60">Tekrar Kontrol Et</button>
          <button onClick={approve} disabled={scenario.status === 'APPROVED' || running} className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Onayla</button>
          <button onClick={generateInsight} disabled={running || aiBusy} className="rounded-md border px-3 py-2 text-sm disabled:opacity-60">
            {aiBusy ? 'AI Yanıtı Bekleniyor...' : 'AI Önerisi Üret'}
          </button>
        </div>
      ) : (
        <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Bu senaryoyu görüntüleyebilirsiniz. Çalıştırma, tekrar kontrol ve onay işlemleri yalnızca sistem yöneticisi tarafından yapılır.
        </div>
      )}
      {actionError ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {actionError}
        </div>
      ) : null}
      {aiMessage ? (
        <div className={`rounded-md border px-4 py-3 text-sm ${aiMessage.includes('alınamadı') || aiMessage.includes('silinemedi') ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200' : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200'}`}>
          {aiMessage}
        </div>
      ) : null}

      <ScenarioExportPanel scenario={scenario} user={user} />

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
            {tab === 'Gözetmenler' && scenario.invigilators.length > 0 && (
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">{scenario.invigilators.length}</span>
            )}
          </button>
        ))}
      </nav>

      {activeTab === 'Özet' && <OverviewTab scenario={scenario} canManageAi={canManageAi} deletingInsightId={deletingInsightId} onDeleteInsight={deleteInsight} />}
      {activeTab === 'Özet' && <ScenarioComparisonPanel comparison={comparison} />}
      {activeTab === 'Takvim' && <ScheduleTab schedules={scenario.schedules} canEdit={canEditSchedule} onEdit={(schedule) => setEditTarget({ kind: 'schedule', schedule })} />}
      {activeTab === 'Derslikler' && <ClassroomTab roomSlotsByDate={roomSlotsByDate} seatSlotsByClassroom={seatSlotsByClassroom} examCoverage={scenario.metrics?.examCoverage as ExamCoverageEntry[] | undefined} canEdit={canManualEdit} onRoomEdit={(slot, assignment) => setEditTarget({ kind: 'room', slot, assignment })} onSeatEdit={(assignment) => setEditTarget({ kind: 'seat', assignment })} />}
      {activeTab === 'Gözetmenler' && <InvigilatorTab invigilators={scenario.invigilators} canEdit={canManualEdit} onEdit={(assignment) => setEditTarget({ kind: 'invigilator', assignment })} />}

      {editTarget ? (
        <ManualEditModal
          target={editTarget}
          classrooms={classrooms}
          invigilators={invigilators}
          onClose={() => setEditTarget(null)}
          onSaved={async () => {
            setEditTarget(null);
            await reload();
          }}
        />
      ) : null}
    </div>
  );
}

function reportUrl(scenarioId: string, path: string) {
  const token = getToken();
  return `${getApiBaseUrl()}/reports/scenarios/${scenarioId}/${path}?token=${encodeURIComponent(token || '')}`;
}

function ScenarioExportPanel({ scenario, user }: { scenario: Scenario; user: CurrentUser | null }) {
  const examOptions = getScenarioExamOptions(scenario);
  const { pdfExports, excelExports, note, allowSingleExamExport } = getRoleReportExports(user);

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h3 className="text-base font-semibold">Çıktılar</h3>
        <p className="text-sm text-slate-500">{note}</p>
      </div>

      <div className={`grid gap-3 ${pdfExports.length === 1 ? '' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
        {pdfExports.map((item) => (
          <a
            key={item.path}
            href={reportUrl(scenario.id, item.path)}
            className="rounded-lg border border-slate-200 p-3 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:hover:border-blue-800 dark:hover:bg-blue-950/30"
          >
            <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{item.label}</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
          </a>
        ))}
      </div>

      {excelExports.length > 0 ? (
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Excel çıktıları</p>
        <div className="flex flex-wrap gap-2">
          {excelExports.map((item) => (
            <a key={item.path} href={reportUrl(scenario.id, item.path)} className="rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950">
              {item.label}
            </a>
          ))}
        </div>
      </div>
      ) : null}

      {allowSingleExamExport && examOptions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Tekil sınav PDF</p>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {examOptions.map((exam) => (
              <a
                key={exam.id}
                href={reportUrl(scenario.id, `exams/${exam.id}.pdf`)}
                className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{exam.code}</span>
                  <span className="block truncate text-xs text-slate-500">{exam.name}</span>
                </span>
                <span className="shrink-0 text-xs font-medium text-blue-600 dark:text-blue-400">PDF</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function getScenarioExamOptions(scenario: Scenario) {
  const seen = new Map<string, { id: string; code: string; name: string }>();
  for (const slot of scenario.roomSlots) {
    for (const assignment of slot.assignments) {
      seen.set(assignment.exam.id, {
        id: assignment.exam.id,
        code: assignment.exam.course.code,
        name: assignment.exam.course.name,
      });
    }
  }
  return [...seen.values()].sort((a, b) => a.code.localeCompare(b.code, 'tr'));
}

function OverviewTab({
  scenario,
  canManageAi,
  deletingInsightId,
  onDeleteInsight,
}: {
  scenario: Scenario;
  canManageAi: boolean;
  deletingInsightId: string | null;
  onDeleteInsight: (id: string) => void;
}) {
  const totalStudents = scenario.seats.length;
  const totalExams = new Set(scenario.schedules.map((s) => s.examId)).size;
  const totalRooms = scenario.roomSlots.length;
  const metrics = scenario.metrics;
  const coverage = metrics?.examCoverage as ExamCoverageEntry[] | undefined;
  const hasIncomplete = coverage?.some((e) => e.missing > 0 || e.extra > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InfoCard label="Toplam Sınav" value={totalExams || '-'} />
        <InfoCard label="Atanmış Öğrenci" value={totalStudents || '-'} />
        <InfoCard label="Kullanilan Derslik" value={totalRooms || '-'} />
        <InfoCard
          label="Kapsam"
          value={metrics?.examCoveragePercent != null ? `${metrics.examCoveragePercent}%` : '-'}
        />
      </div>

      {/* Per-exam coverage table */}
      {coverage && coverage.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-semibold text-sm">Sınav Atama Kapsamı</h3>
            {hasIncomplete && (
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-400">
                Eksik Atama Var
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 text-xs">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Ders</th>
                  <th className="px-4 py-2 text-right font-semibold">Beklenen</th>
                  <th className="px-4 py-2 text-right font-semibold">Atanan</th>
                  <th className="px-4 py-2 text-left font-semibold">Durum</th>
                </tr>
              </thead>
              <tbody>
                {coverage.map((e) => {
                  const complete = e.missing === 0 && e.extra === 0;
                  return (
                    <tr key={e.examId} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2 font-medium">{e.courseCode}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{e.expected}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold">
                        <span className={complete ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {e.actual}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {complete ? (
                          <span className="text-xs text-green-600 dark:text-green-400">✓ Tam</span>
                        ) : e.missing > 0 ? (
                          <span className="text-xs text-red-600 dark:text-red-400">{e.missing} öğrenci atamasız kaldı</span>
                        ) : (
                          <span className="text-xs text-amber-600 dark:text-amber-400">{e.extra} fazla atama</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PlanQualityPanel metrics={metrics} />

      {scenario.warnings && scenario.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <h3 className="mb-2 font-semibold text-amber-700 dark:text-amber-400">Uyarılar ({scenario.warnings.length})</h3>
          <p className="mb-2 text-sm text-amber-800 dark:text-amber-300">Tek kitapçıklı sınavlarda bazı ön-arka yerleşimler kaçınılmaz olabilir.</p>
          <ul className="space-y-1">
            {scenario.warnings.map((w, i) => (
              <li key={i} className={`text-sm ${w.severity === 'hard' ? 'text-red-700 dark:text-red-400' : w.severity === 'info' ? 'text-slate-600 dark:text-slate-300' : 'text-amber-800 dark:text-amber-300'}`}>
                <span className="font-mono text-xs opacity-60">[{(w as Warning & { type?: string }).type ?? w.code}]</span> {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {scenario.insights.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">AI Önerileri ({scenario.insights.length})</h3>
          {scenario.insights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              canDelete={canManageAi}
              deleting={deletingInsightId === insight.id}
              onDelete={() => onDeleteInsight(insight.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InsightCard({
  insight,
  canDelete,
  deleting,
  onDelete,
}: {
  insight: Insight;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  const suggestions = insightSuggestions(insight.suggestions);
  const risks = insightList(insight.risks);
  const manualChecks = insightManualChecks(insight.suggestions);
  const providerNote = insightProviderNote(insight.suggestions);
  const riskLevel = insightRiskLevel(insight.suggestions);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>{formatDate(insight.createdAt)}</span>
          <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">{insight.provider || 'heuristic'}</span>
          {insight.model ? <span>{insight.model}</span> : null}
          <span className={`rounded px-2 py-0.5 font-semibold ${riskLevel === 'high' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' : riskLevel === 'low' ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
            Risk: {riskLevel}
          </span>
        </div>
        {canDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950"
          >
            {deleting ? 'Siliniyor...' : 'Sil'}
          </button>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{insight.summary}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <InsightList title="Riskler" items={risks} tone="amber" />
        <InsightList title="Öneriler" items={suggestions} tone="green" />
        <InsightList title="Manuel Kontroller" items={manualChecks} tone="blue" />
      </div>
      {providerNote ? <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-950">{providerNote}</p> : null}
    </div>
  );
}

function InsightList({ title, items, tone }: { title: string; items: string[]; tone: 'amber' | 'green' | 'blue' }) {
  const color = tone === 'green' ? 'text-green-700 dark:text-green-300' : tone === 'blue' ? 'text-blue-700 dark:text-blue-300' : 'text-amber-700 dark:text-amber-300';
  return (
    <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-950">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {items.length ? (
        <ul className="space-y-1">
          {items.map((item, index) => <li key={`${item}-${index}`} className={`text-xs leading-5 ${color}`}>{item}</li>)}
        </ul>
      ) : <p className="text-xs text-slate-400">Yok</p>}
    </div>
  );
}

function insightList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).filter(Boolean);
  return [];
}

function insightSuggestions(value: unknown): string[] {
  if (Array.isArray(value)) return insightList(value);
  if (value && typeof value === 'object' && Array.isArray((value as { items?: unknown[] }).items)) return insightList((value as { items: unknown[] }).items);
  return [];
}

function insightManualChecks(value: unknown): string[] {
  if (value && typeof value === 'object' && Array.isArray((value as { manualChecks?: unknown[] }).manualChecks)) return insightList((value as { manualChecks: unknown[] }).manualChecks);
  return [];
}

function insightRiskLevel(value: unknown): string {
  if (value && typeof value === 'object' && typeof (value as { riskLevel?: unknown }).riskLevel === 'string') return (value as { riskLevel: string }).riskLevel;
  return 'medium';
}

function insightProviderNote(value: unknown): string {
  if (value && typeof value === 'object' && typeof (value as { providerNote?: unknown }).providerNote === 'string') return (value as { providerNote: string }).providerNote;
  return '';
}

function PlanQualityPanel({ metrics }: { metrics?: Metrics }) {
  if (!metrics) return null;
  const qualityItems = [
    { label: 'Fiziksel salon doluluğu', value: percentMetric(metrics.averagePhysicalRoomUtilization ?? metrics.physicalRoomUtilization) },
    { label: 'Sınav kapasitesi doluluğu', value: percentMetric(metrics.averageExamCapacityUtilization ?? metrics.examCapacityUtilization) },
    { label: 'Boş fiziksel kapasite', value: numberMetric(metrics.totalPhysicalUnusedCapacity ?? metrics.totalUnusedCapacity) },
    { label: 'Gözetmen yük dengesi', value: numberMetric(metrics.invigilatorLoadImbalance ?? metrics.invigilatorFairnessPenalty) },
    { label: 'Öğrenci günlük yükü', value: numberMetric(metrics.studentDailyLoadPenalty ?? metrics.sameDayStudentPenalty) },
    { label: 'Ardışık sınav yükü', value: numberMetric(metrics.backToBackPenalty ?? metrics.studentBackToBackPenalty) },
  ].filter((item) => item.value !== '-');
  if (qualityItems.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 font-semibold text-sm">Plan Kalitesi</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {qualityItems.map((item) => (
          <div key={item.label} className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-950">
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="mt-1 font-semibold">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function percentMetric(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return `%${Math.round(number * 100)}`;
}

function numberMetric(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return String(Math.round(number * 100) / 100);
}

function formatDelta(value: unknown, format: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  const sign = number > 0 ? '+' : '';
  if (format === 'percent') return `${sign}%${Math.round(number * 100)}`;
  return `${sign}${Math.round(number * 100) / 100}`;
}

function ScheduleTab({ schedules, canEdit, onEdit }: { schedules: Schedule[]; canEdit: boolean; onEdit: (schedule: Schedule) => void }) {
  if (schedules.length === 0) return <p className="text-slate-500">Henüz takvim oluşturulmadı.</p>;
  const sorted = [...schedules].sort((a, b) => {
    const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.startTime.localeCompare(b.startTime);
  });
  return (
    <DataTable
      columns={['Ders', 'Tarih', 'Başlangıç', 'Bitiş', 'Süre (dk)', '']}
      rows={sorted.map((s) => [
        `${s.exam.course.code} - ${s.exam.course.name}`,
        formatDate(s.date),
        s.startTime,
        s.endTime,
        s.durationMinutes,
        canEdit ? <button key={s.id} onClick={() => onEdit(s)} className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-950">Zamanı Değiştir</button> : null,
      ])}
    />
  );
}

function ClassroomTab({
  roomSlotsByDate,
  seatSlotsByClassroom,
  examCoverage,
  canEdit,
  onRoomEdit,
  onSeatEdit,
}: {
  roomSlotsByDate: Record<string, RoomSlot[]>;
  seatSlotsByClassroom: Record<string, SeatAssignment[]>;
  examCoverage?: ExamCoverageEntry[];
  canEdit: boolean;
  onRoomEdit: (slot: RoomSlot, assignment: RoomSlot['assignments'][number]) => void;
  onSeatEdit: (assignment: SeatAssignment) => void;
}) {
  const coverageByExamId = new Map((examCoverage || []).map((e) => [e.examId, e]));
  if (Object.keys(roomSlotsByDate).length === 0) return <p className="text-slate-500">Henüz derslik ataması yapılmadı.</p>;

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
                      <p className="text-sm text-slate-500">
                        {slot.startTime} &ndash; {slot.endTime}
                        {' '}&middot;{' '}
                        {slotSeats.length}/{slot.classroom.rowCount * slot.classroom.columnCount} koltuk
                        {slot.classroom.rowCount > 0 && slot.classroom.columnCount > 0 && (
                          <> ({slot.classroom.columnCount} sütun &times; {slot.classroom.rowCount} sıra)</>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      {slot.assignments.map((a) => {
                        const cIdx = colorByCourse.get(a.exam.course.code);
                        const cov = coverageByExamId.get(a.exam.id);
                        const complete = !cov || (cov.missing === 0 && cov.extra === 0);
                        return (
                          <span key={a.exam.id} className={cIdx !== undefined ? `${COURSE_COLORS[cIdx].text} font-medium` : 'text-slate-500'}>
                            {a.exam.course.code}{' '}
                            <span className={complete ? '' : 'text-red-600 dark:text-red-400 font-bold'}>
                              ({a.assignedCount}{cov ? `/${cov.expected}` : ''})
                            </span>
                            {!complete && cov && cov.missing > 0 && (
                              <span className="ml-1 text-[10px] text-red-600 dark:text-red-400">⚠ {cov.missing} eksik</span>
                            )}
                          </span>
                        );
                      })}
                      {canEdit && slot.assignments.length === 1 ? (
                        <button onClick={() => onRoomEdit(slot, slot.assignments[0])} className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-950">Salon Değiştir</button>
                      ) : canEdit && slot.assignments.length > 1 ? (
                        <span className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">Karma slot salonu kilitli</span>
                      ) : null}
                    </div>
                  </div>
                  <SeatGrid seats={slotSeats} colorByCourse={colorByCourse} classroom={slot.classroom} onSeatEdit={canEdit ? onSeatEdit : undefined} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SeatGrid({ seats, colorByCourse, classroom, onSeatEdit }: { seats: SeatAssignment[]; colorByCourse: Map<string, number>; classroom: { id: string; rowCount: number; columnCount: number }; onSeatEdit?: (assignment: SeatAssignment) => void }) {
  const maxRow = classroom.rowCount || Math.max(...seats.map((s) => s.seat.row), 0);
  const maxCol = classroom.columnCount || Math.max(...seats.map((s) => s.seat.column), 0);
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
            const row = Math.floor(i / maxCol) + 1;
            const col = (i % maxCol) + 1;
            return (
              <div key={i} className="flex h-12 w-12 flex-col items-center justify-center rounded-md border border-dashed border-slate-200 text-[9px] text-slate-300 dark:border-slate-700 dark:text-slate-600">
                <span>{row}-{col}</span>
              </div>
            );
          }
          const colorIdx = colorByCourse.get(s.exam.course.code) ?? 0;
          const colors = COURSE_COLORS[colorIdx];
          return (
            <div
              key={`${s.seat.row}-${s.seat.column}`}
              role={onSeatEdit ? 'button' : undefined}
              tabIndex={onSeatEdit ? 0 : undefined}
              onClick={() => onSeatEdit?.(s)}
              className={`group relative flex h-12 w-12 flex-col items-center justify-center rounded-md border text-center ${colors.border} ${colors.bg}`}
            >
              <span className={`text-[10px] font-bold ${colors.text}`}>
                {s.student.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </span>
              <span className="text-[9px] opacity-50">{s.seat.label}</span>
              {s.bookletType && (
                <span className={`text-[8px] font-semibold ${colors.text} opacity-80`}>{s.bookletType}</span>
              )}
              {s.locked && <span className="absolute right-0.5 top-0.5 text-[9px]">K</span>}
              <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2.5 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 z-20 shadow-lg">
                <p className="font-semibold">{s.student.fullName}</p>
                <p className="text-slate-300">{s.student.studentNo}</p>
                <p className="text-slate-400">{s.exam.course.code} {s.exam.course.name}</p>
                {s.bookletType && <p className="text-slate-300">Kitapçık {s.bookletType}</p>}
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

function ScenarioComparisonPanel({ comparison }: { comparison: ScenarioComparison | null }) {
  if (!comparison) return null;
  if (!comparison.previous || !comparison.deltas) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        Karşılaştırma için aynı dönemde daha eski tamamlanmış/onaylı senaryo bulunamadı.
      </div>
    );
  }
  const items = [
    { key: 'score', label: 'Skor', format: 'number', lowerIsBetter: false },
    { key: 'physicalUtilization', label: 'Fiziksel doluluk', format: 'percent', lowerIsBetter: false },
    { key: 'unusedCapacity', label: 'Boş kapasite', format: 'number', lowerIsBetter: true },
    { key: 'invigilatorLoad', label: 'Gözetmen yük farkı', format: 'number', lowerIsBetter: true },
    { key: 'studentLoad', label: 'Öğrenci günlük yükü', format: 'number', lowerIsBetter: true },
    { key: 'backToBackLoad', label: 'Ardışık sınav yükü', format: 'number', lowerIsBetter: true },
  ];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">Önceki Senaryoya Göre Fark</h3>
        <p className="text-xs text-slate-500">{comparison.previous.name} ile karşılaştırılıyor.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {items.map((item) => {
          const delta = comparison.deltas?.[item.key];
          const improved = delta == null ? null : item.lowerIsBetter ? delta < 0 : delta > 0;
          return (
            <div key={item.key} className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-950">
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className={`mt-1 font-semibold ${improved === true ? 'text-green-600' : improved === false && delta !== 0 ? 'text-amber-600' : ''}`}>
                {formatDelta(delta, item.format)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

async function manualPatch(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  return {
    ok: response.ok,
    message: payload?.message || (response.ok ? 'Kaydedildi.' : 'İşlem başarısız oldu.'),
    validation: payload?.validation as ValidationResult | undefined,
  };
}

function ManualEditModal({
  target,
  classrooms,
  invigilators,
  onClose,
  onSaved,
}: {
  target: EditTarget;
  classrooms: ClassroomResource[];
  invigilators: InvigilatorResource[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, string | boolean>>(() => initialManualForm(target));
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const title = target.kind === 'schedule' ? 'Sınav Zamanı Değiştir' : target.kind === 'room' ? 'Salon Değiştir' : target.kind === 'seat' ? 'Koltuk Değiştir / Kilitle' : 'Gözetmen Değiştir';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setValidation(null);
    const { path, body } = manualPatchPayload(target, form);
    const result = await manualPatch(path, body);
    setValidation(result.validation || null);
    setMessage(result.message);
    setSaving(false);
    if (result.ok) await onSaved();
  }

  const currentRoomSeats = target.kind === 'seat'
    ? (target.assignment.classroom.seats || []).filter((seat) => seat.status === 'AKTIF')
    : [];

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {target.kind === 'schedule' ? (
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Tarih"><input type="date" className={inputClass} value={String(form.date || '')} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></Field>
            <Field label="Başlangıç"><input type="time" className={inputClass} value={String(form.startTime || '')} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required /></Field>
            <Field label="Bitiş"><input type="time" className={inputClass} value={String(form.endTime || '')} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required /></Field>
          </div>
        ) : null}

        {target.kind === 'room' ? (
          <Field label="Yeni Salon">
            <select className={inputClass} value={String(form.classroomId || '')} onChange={(e) => setForm({ ...form, classroomId: e.target.value })} required>
              <option value="">Salon seç</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>{classroom.code} - {classroom.name} ({classroom.examCapacity || classroom.capacity})</option>
              ))}
            </select>
          </Field>
        ) : null}

        {target.kind === 'seat' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Koltuk">
              <select className={inputClass} value={String(form.seatId || '')} onChange={(e) => setForm({ ...form, seatId: e.target.value })} required>
                <option value="">Koltuk seç</option>
                {currentRoomSeats.map((seat) => (
                  <option key={seat.id} value={seat.id}>{seat.label} ({seat.row}. sıra, {seat.column}. sütun)</option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
              <input type="checkbox" checked={Boolean(form.locked)} onChange={(e) => setForm({ ...form, locked: e.target.checked })} />
              Koltuğu kilitle
            </label>
          </div>
        ) : null}

        {target.kind === 'invigilator' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Gözetmen">
              <select className={inputClass} value={String(form.invigilatorId || '')} onChange={(e) => setForm({ ...form, invigilatorId: e.target.value })} required>
                <option value="">Gözetmen seç</option>
                {invigilators.map((invigilator) => (
                  <option key={invigilator.id} value={invigilator.id}>{invigilator.firstName} {invigilator.lastName}</option>
                ))}
              </select>
            </Field>
            <Field label="Rol"><input className={inputClass} value={String(form.role || '')} onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
          </div>
        ) : null}

        {message ? <ValidationBox message={message} validation={validation} /> : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm dark:border-slate-700">İptal</button>
          <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? 'Kontrol ediliyor...' : 'Kontrol Et ve Kaydet'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function initialManualForm(target: EditTarget): Record<string, string | boolean> {
  if (target.kind === 'schedule') {
    return {
      date: target.schedule.date.slice(0, 10),
      startTime: target.schedule.startTime,
      endTime: target.schedule.endTime,
    };
  }
  if (target.kind === 'room') return { classroomId: target.assignment.classroomId || target.slot.classroom.id };
  if (target.kind === 'seat') return { seatId: target.assignment.seatId, locked: Boolean(target.assignment.locked) };
  return { invigilatorId: target.assignment.invigilator.id, role: target.assignment.role || 'Gözetmen' };
}

function manualPatchPayload(target: EditTarget, form: Record<string, string | boolean>) {
  if (target.kind === 'schedule') return { path: `/exams/${target.schedule.examId}/schedule`, body: form };
  if (target.kind === 'room') return { path: `/room-assignments/${target.assignment.id}`, body: { classroomId: form.classroomId } };
  if (target.kind === 'seat') return { path: `/seat-assignments/${target.assignment.id}`, body: { seatId: form.seatId, locked: form.locked } };
  return { path: `/invigilator-assignments/${target.assignment.id}`, body: { invigilatorId: form.invigilatorId, role: form.role } };
}

function ValidationBox({ message, validation }: { message: string; validation: ValidationResult | null }) {
  const hasHard = (validation?.hard || []).length > 0;
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${hasHard ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300' : 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300'}`}>
      <p className="font-semibold">{message}</p>
      {(validation?.hard || []).map((item) => <p key={item.code} className="mt-1">[{item.code}] {item.message}</p>)}
      {(validation?.soft || []).map((item) => <p key={item.code} className="mt-1 text-amber-700 dark:text-amber-300">[{item.code}] {item.message}</p>)}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const inputClass = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900';

function InvigilatorTab({ invigilators, canEdit, onEdit }: { invigilators: InvigilatorAssignment[]; canEdit: boolean; onEdit: (assignment: InvigilatorAssignment) => void }) {
  if (invigilators.length === 0) return <p className="text-slate-500">Henüz gözetmen ataması yapılmadı.</p>;
  return (
    <DataTable
      columns={['Gözetmen', 'Unvan', 'Ders', 'Rol', '']}
      rows={invigilators.map((a) => [
        `${a.invigilator.firstName} ${a.invigilator.lastName}`,
        a.invigilator.title,
        `${a.exam.course.code} - ${a.exam.course.name}`,
        a.role,
        canEdit ? <button key={a.id} onClick={() => onEdit(a)} className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-950">Gözetmen Değiştir</button> : null,
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
