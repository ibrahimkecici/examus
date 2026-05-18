const test = require('node:test');
const assert = require('node:assert/strict');
const { aiConfig, buildMessages, resolveInsight, heuristicInsight } = require('../src/services/aiService');

test('heuristic insight summarizes warnings and suggestions', () => {
  const insight = heuristicInsight({
    metrics: { plannedExamCount: 4, totalExamCount: 5, scheduledDays: 6, capacityWaste: 20 },
    warnings: [{ type: 'INVIGILATOR', message: 'Eksik gözetmen' }],
  });

  assert.equal(insight.provider, 'heuristic');
  assert.match(insight.summary, /4\/5/);
  assert.equal(insight.risks.length, 1);
  assert.ok(insight.suggestions.length >= 2);
  assert.ok(insight.manualChecks.length > 0);
});

test('lmstudio provider builds OpenAI-compatible request body', async () => {
  let capturedUrl = '';
  let capturedBody = null;
  const insight = await resolveInsight(
    { name: 'S1', strategy: 'optimal_cp_sat', score: 91, metrics: { examCoveragePercent: 100 }, warnings: [] },
    {
      env: { AI_PROVIDER: 'lmstudio', AI_MODEL: 'nemotron-3-nano-4b', AI_BASE_URL: 'http://localhost:1234/v1', AI_TIMEOUT_MS: '1000' },
      fetchImpl: async (url, init = {}) => {
        if (String(url).endsWith('/models')) {
          return { ok: true, json: async () => ({ data: [{ id: 'nvidia/nemotron-3-nano-4b' }] }) };
        }
        capturedUrl = url;
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify({ summary: 'Plan iyi.', riskLevel: 'low', risks: [], suggestions: ['Kontrol et'], manualChecks: ['Raporu aç'], providerNote: 'local' }) } }],
          }),
        };
      },
    },
  );

  assert.equal(capturedUrl, 'http://localhost:1234/v1/chat/completions');
  assert.equal(capturedBody.model, 'nvidia/nemotron-3-nano-4b');
  assert.equal(capturedBody.response_format, undefined);
  assert.equal(capturedBody.messages.length, 2);
  assert.equal(insight.provider, 'lmstudio');
  assert.equal(insight.model, 'nvidia/nemotron-3-nano-4b');
});

test('provider failures fall back to heuristic insight', async () => {
  const insight = await resolveInsight(
    { metrics: { plannedExamCount: 1, totalExamCount: 1 }, warnings: [] },
    {
      env: { AI_PROVIDER: 'lmstudio', AI_MODEL: 'nemotron-3-nano-4b', AI_BASE_URL: 'http://localhost:1234/v1' },
      fetchImpl: async () => {
        throw new Error('connection refused');
      },
    },
  );

  assert.equal(insight.provider, 'heuristic');
  assert.match(insight.providerNote, /connection refused/);
});

test('openai without api key falls back to heuristic', async () => {
  const insight = await resolveInsight(
    { metrics: { plannedExamCount: 1, totalExamCount: 1 }, warnings: [] },
    { env: { AI_PROVIDER: 'openai', AI_API_KEY: '', AI_MODEL: 'gpt-4o-mini' } },
  );

  assert.equal(insight.provider, 'heuristic');
  assert.match(insight.providerNote, /AI_API_KEY/);
});

test('malformed model JSON falls back to heuristic', async () => {
  const insight = await resolveInsight(
    { metrics: { plannedExamCount: 2, totalExamCount: 2 }, warnings: [] },
    {
      env: { AI_PROVIDER: 'lmstudio', AI_BASE_URL: 'http://localhost:1234/v1' },
      fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'not json' } }] }) }),
    },
  );

  assert.equal(insight.provider, 'heuristic');
  assert.match(insight.providerNote, /JSON/);
});

test('ai config defaults lmstudio to nemotron model', () => {
  const config = aiConfig({ AI_PROVIDER: 'lmstudio' });
  assert.equal(config.model, 'nemotron-3-nano-4b');
  assert.equal(config.baseUrl, 'http://127.0.0.1:1234/v1');
});

test('prompt includes scenario quality context', () => {
  const messages = buildMessages({ name: 'S1', metrics: { averagePhysicalRoomUtilization: 0.6 }, warnings: [] });
  assert.match(messages[0].content, /JSON şeması/);
  assert.match(messages[1].content, /averagePhysicalRoomUtilization/);
});
