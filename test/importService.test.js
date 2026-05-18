const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { buildTemplateWorkbookBuffer } = require('../src/services/importService');

test('xlsx template endpoint data contains course instructor matching columns', () => {
  const buffer = buildTemplateWorkbookBuffer('courses');
  assert.ok(buffer.length > 100);

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  assert.deepEqual(workbook.SheetNames, ['Veri', 'Açıklamalar']);

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Veri, { header: 1 });
  assert.deepEqual(rows[0].slice(0, 5), ['code', 'name', 'instructorEmail', 'instructorStaffNo', 'instructorName']);
});

test('xlsx templates are available for all supported import types', () => {
  for (const type of ['students', 'courses', 'invigilators', 'classrooms']) {
    const buffer = buildTemplateWorkbookBuffer(type);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    assert.ok(buffer.length > 100, `${type} template should not be empty`);
    assert.ok(workbook.SheetNames.includes('Veri'));
    assert.ok(workbook.SheetNames.includes('Açıklamalar'));
  }
});
