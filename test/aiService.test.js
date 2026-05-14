const test = require('node:test');
const assert = require('node:assert/strict');
const { heuristicInsight } = require('../src/services/aiService');

test('heuristic insight summarizes warnings and suggestions', () => {
  const insight = heuristicInsight({
    metrics: { plannedExamCount: 4, totalExamCount: 5, scheduledDays: 6, capacityWaste: 20 },
    warnings: [{ type: 'INVIGILATOR', message: 'Eksik gözetmen' }],
  });

  assert.equal(insight.provider, 'heuristic');
  assert.match(insight.summary, /4\/5/);
  assert.equal(insight.risks.length, 1);
  assert.ok(insight.suggestions.length >= 2);
});
