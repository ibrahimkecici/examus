const prisma = require('../config/prisma');

function heuristicInsight(scenario) {
  const metrics = scenario.metrics || {};
  const warnings = Array.isArray(scenario.warnings) ? scenario.warnings : [];
  const suggestions = [];

  if ((metrics.capacityWaste || 0) > 0) {
    suggestions.push('Kapasite israfını azaltmak için küçük dersler aynı zaman diliminde daha küçük salonlara taşınabilir.');
  }
  if ((metrics.scheduledDays || 0) > 5) {
    suggestions.push('Büyük kapasiteli salonlar önceliklendirilirse toplam sınav günü azaltılabilir.');
  }
  if (warnings.some((warning) => warning.type === 'INVIGILATOR')) {
    suggestions.push('Gözetmen yükünü dengelemek için müsaitlik kayıtları ve maksimum görev sayıları güncellenmeli.');
  }

  return {
    provider: 'heuristic',
    model: null,
    summary: `Senaryo ${metrics.plannedExamCount || 0}/${metrics.totalExamCount || 0} sınavı ${metrics.scheduledDays || 0} güne yerleştirdi. Risk sayısı: ${warnings.length}.`,
    risks: warnings,
    suggestions: suggestions.length ? suggestions : ['Plan uygulanabilir görünüyor; manuel değişikliklerden sonra tekrar çakışma kontrolü çalıştırın.'],
  };
}

async function callLlm(scenario) {
  if (!process.env.AI_API_KEY || process.env.AI_PROVIDER !== 'openai') return null;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Sınav planlama uzmanı gibi kısa, uygulanabilir Türkçe öneriler üret.' },
        { role: 'user', content: JSON.stringify({ metrics: scenario.metrics, warnings: scenario.warnings }) },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  const parsed = JSON.parse(content);

  return {
    provider: 'openai',
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    summary: parsed.summary || parsed.ozet || 'AI önerisi üretildi.',
    risks: parsed.risks || parsed.riskler || [],
    suggestions: parsed.suggestions || parsed.oneriler || [],
  };
}

async function generateInsight(scenarioId) {
  const scenario = await prisma.planningScenario.findUnique({ where: { id: scenarioId } });
  if (!scenario) {
    const error = new Error('Planlama senaryosu bulunamadı.');
    error.status = 404;
    throw error;
  }

  const insight = (await callLlm(scenario).catch(() => null)) || heuristicInsight(scenario);
  return prisma.aiInsight.create({
    data: {
      scenarioId,
      provider: insight.provider,
      model: insight.model,
      summary: insight.summary,
      risks: insight.risks,
      suggestions: insight.suggestions,
    },
  });
}

module.exports = { generateInsight, heuristicInsight };
