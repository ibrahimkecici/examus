const prisma = require('../config/prisma');

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_LMSTUDIO_BASE_URL = 'http://127.0.0.1:1234/v1';

function compactArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'string') return item.trim();
    if (item && typeof item === 'object') return item.message || item.text || item.title || JSON.stringify(item);
    return String(item || '').trim();
  }).filter(Boolean);
}

function aiConfig(env = process.env) {
  const provider = String(env.AI_PROVIDER || 'heuristic').toLowerCase();
  const timeoutMs = Number(env.AI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  if (provider === 'lmstudio') {
    return {
      provider,
      model: env.AI_MODEL || 'nemotron-3-nano-4b',
      baseUrl: (env.AI_BASE_URL || DEFAULT_LMSTUDIO_BASE_URL).replace(/\/$/, ''),
      apiKey: env.AI_API_KEY || '',
      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS,
    };
  }
  if (provider === 'openai') {
    return {
      provider,
      model: env.AI_MODEL || 'gpt-4o-mini',
      baseUrl: (env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
      apiKey: env.AI_API_KEY || '',
      timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS,
    };
  }
  return {
    provider: 'heuristic',
    model: null,
    baseUrl: '',
    apiKey: '',
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS,
  };
}

function scenarioContext(scenario) {
  const metrics = scenario.metrics || {};
  const warnings = Array.isArray(scenario.warnings) ? scenario.warnings : [];
  return {
    name: scenario.name,
    strategy: scenario.strategy,
    status: scenario.status,
    score: scenario.score,
    periodId: scenario.periodId,
    metrics: {
      plannedExamCount: metrics.plannedExamCount,
      totalExamCount: metrics.totalExamCount,
      scheduledDays: metrics.scheduledDays,
      usedDayCount: metrics.usedDayCount,
      lastUsedSlot: metrics.lastUsedSlot,
      examCoveragePercent: metrics.examCoveragePercent,
      averagePhysicalRoomUtilization: metrics.averagePhysicalRoomUtilization,
      averageExamCapacityUtilization: metrics.averageExamCapacityUtilization,
      totalPhysicalUnusedCapacity: metrics.totalPhysicalUnusedCapacity,
      totalUnusedCapacity: metrics.totalUnusedCapacity,
      invigilatorLoadImbalance: metrics.invigilatorLoadImbalance,
      invigilatorFairnessPenalty: metrics.invigilatorFairnessPenalty,
      studentDailyLoadPenalty: metrics.studentDailyLoadPenalty,
      sameDayStudentPenalty: metrics.sameDayStudentPenalty,
      backToBackPenalty: metrics.backToBackPenalty,
      studentBackToBackPenalty: metrics.studentBackToBackPenalty,
      mixedRoomCount: metrics.mixedRoomCount,
    },
    warnings: warnings.slice(0, 30).map((warning) => ({
      type: warning.type || warning.code,
      severity: warning.severity,
      message: warning.message,
    })),
  };
}

function normalizeInsight(raw, provider, model, providerNote = '') {
  const parsed = raw && typeof raw === 'object' ? raw : {};
  const summary = parsed.summary || parsed.ozet || parsed.overview || 'AI analizi üretildi.';
  return {
    provider,
    model,
    summary: String(summary).trim(),
    risks: compactArray(parsed.risks || parsed.riskler),
    suggestions: compactArray(parsed.suggestions || parsed.oneriler),
    manualChecks: compactArray(parsed.manualChecks || parsed.manual_checks || parsed.kontroller),
    riskLevel: parsed.riskLevel || parsed.risk_level || parsed.riskSeviyesi || 'medium',
    providerNote: providerNote || parsed.providerNote || parsed.provider_note || '',
  };
}

function heuristicInsight(scenario, fallbackReason = '') {
  const metrics = scenario.metrics || {};
  const warnings = Array.isArray(scenario.warnings) ? scenario.warnings : [];
  const risks = warnings.map((warning) => warning.message || warning.type || warning.code).filter(Boolean).slice(0, 10);
  const suggestions = [];

  if ((metrics.totalPhysicalUnusedCapacity || metrics.totalUnusedCapacity || metrics.capacityWaste || 0) > 0) {
    suggestions.push('Küçük sınavları daha küçük salonlara veya uygun karma salonlara taşıyarak boş fiziksel kapasiteyi azaltın.');
  }
  if ((metrics.averagePhysicalRoomUtilization || 0) > 0 && metrics.averagePhysicalRoomUtilization < 0.45) {
    suggestions.push('Fiziksel salon doluluğu düşük; büyük salonları yalnızca yüksek mevcutlu sınavlara ayırın.');
  }
  if ((metrics.scheduledDays || metrics.usedDayCount || 0) > 5) {
    suggestions.push('Takvim çok yayılmışsa çakışmasız ortak boş slotlarda küçük sınavları sıkıştırmayı deneyin.');
  }
  if (warnings.some((warning) => String(warning.type || warning.code || '').includes('INVIGILATOR'))) {
    suggestions.push('Gözetmen yükünü dengelemek için müsaitlik ve maksimum görev sayılarını kontrol edin.');
  }

  return {
    provider: 'heuristic',
    model: null,
    summary: `Senaryo ${metrics.plannedExamCount || 0}/${metrics.totalExamCount || 0} sınavı ${metrics.scheduledDays || metrics.usedDayCount || 0} güne yerleştirdi. Kapsam: %${metrics.examCoveragePercent ?? 0}. Risk sayısı: ${warnings.length}.`,
    risks,
    suggestions: suggestions.length ? suggestions : ['Plan uygulanabilir görünüyor; manuel değişikliklerden sonra tekrar çakışma kontrolü çalıştırın.'],
    manualChecks: ['Uyarılar panelindeki hard/soft uyarıları kontrol edin.', 'Manuel değişiklik yaptıysanız tekrar kontrol çalıştırın.'],
    riskLevel: warnings.some((warning) => warning.severity === 'hard') ? 'high' : warnings.length ? 'medium' : 'low',
    providerNote: fallbackReason ? `LLM yerine heuristic fallback çalıştı: ${fallbackReason}` : 'Çevrimdışı heuristic analiz.',
  };
}

function buildMessages(scenario) {
  return [
    {
      role: 'system',
      content: [
        'Üniversite sınav planlama kalite analisti gibi davran.',
        'Yanıtı kısa Türkçe JSON olarak ver.',
        'Kesinlikle planı değiştirme; sadece analiz, risk, öneri ve manuel kontrol listesi üret.',
        'JSON şeması: {"summary":string,"riskLevel":"low|medium|high","risks":string[],"suggestions":string[],"manualChecks":string[],"providerNote":string}',
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify(scenarioContext(scenario)),
    },
  ];
}

function parseJsonContent(content) {
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    const match = String(content).match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function callOpenAiCompatible(scenario, config, fetchImpl = global.fetch) {
  if (config.provider === 'openai' && !config.apiKey) {
    throw new Error('OpenAI için AI_API_KEY tanımlı değil.');
  }
  if (!fetchImpl) throw new Error('fetch kullanılamıyor.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const model = config.provider === 'lmstudio' ? await resolveLmStudioModel(config, fetchImpl, controller.signal) : config.model;
    const headers = { 'Content-Type': 'application/json' };
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
    const body = {
      model,
      messages: buildMessages(scenario),
      temperature: 0.2,
      max_tokens: 900,
    };
    if (config.provider === 'openai') {
      body.response_format = { type: 'json_object' };
    }
    const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${config.provider} HTTP ${response.status}`);
    const data = await response.json();
    const parsed = parseJsonContent(data.choices?.[0]?.message?.content);
    if (!parsed) throw new Error('Model geçerli JSON döndürmedi.');
    return normalizeInsight(parsed, config.provider, model, config.provider === 'lmstudio' ? 'LM Studio lokal model analizi.' : 'OpenAI model analizi.');
  } finally {
    clearTimeout(timer);
  }
}

async function resolveLmStudioModel(config, fetchImpl, signal) {
  const response = await fetchImpl(`${config.baseUrl}/models`, { signal });
  if (!response.ok) return config.model;
  const payload = await response.json().catch(() => null);
  const models = Array.isArray(payload?.data) ? payload.data.map((model) => model.id).filter(Boolean) : [];
  if (models.includes(config.model)) return config.model;
  const suffixMatch = models.find((model) => model.endsWith(`/${config.model}`));
  return suffixMatch || config.model;
}

async function resolveInsight(scenario, options = {}) {
  const config = aiConfig(options.env || process.env);
  if (config.provider === 'heuristic') return heuristicInsight(scenario);
  try {
    return await callOpenAiCompatible(scenario, config, options.fetchImpl || global.fetch);
  } catch (error) {
    return heuristicInsight(scenario, error.name === 'AbortError' ? `${config.provider} zaman aşımına uğradı.` : error.message);
  }
}

async function generateInsight(scenarioId) {
  const scenario = await prisma.planningScenario.findUnique({ where: { id: scenarioId } });
  if (!scenario) {
    const error = new Error('Planlama senaryosu bulunamadı.');
    error.status = 404;
    throw error;
  }

  const insight = await resolveInsight(scenario);
  return prisma.aiInsight.create({
    data: {
      scenarioId,
      provider: insight.provider,
      model: insight.model,
      summary: insight.summary,
      risks: insight.risks,
      suggestions: {
        items: insight.suggestions,
        manualChecks: insight.manualChecks,
        riskLevel: insight.riskLevel,
        providerNote: insight.providerNote,
      },
    },
  });
}

module.exports = {
  aiConfig,
  buildMessages,
  callOpenAiCompatible,
  generateInsight,
  heuristicInsight,
  normalizeInsight,
  resolveLmStudioModel,
  resolveInsight,
  scenarioContext,
};
