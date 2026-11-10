// Unit tests for the JavaScript inside n8n Code nodes.
// Pulls each node's jsCode straight from the workflow JSON, so the tests always
// run against what you import into n8n. Run: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const wf = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', f), 'utf8'));
const code = (workflow, name) => workflow.nodes.find((n) => n.name === name).parameters.jsCode;

function run(body, items, refs = {}) {
  const $input = { first: () => ({ json: items[0] }), all: () => items.map((json) => ({ json })) };
  const $ = (name) => ({ first: () => ({ json: refs[name] }) });
  return new Function('$input', '$', body)($input, $);
}

const dsar = wf('gdpr-dsar/dsar-workflow.json');
const monitor = wf('gdpr-dsar/deadline-monitor.json');
const normalize = code(dsar, 'Normalize Request');
const inventory = code(dsar, 'Build Data Inventory');
const atRisk = code(monitor, 'Find Requests at Risk');

const normalizeReq = (body) => run(normalize, [{ body }])[0].json;

test('GDPR deadline is one calendar month, clamped to month end', () => {
  const cases = {
    '2026-01-31T10:00:00Z': '2026-02-28',
    '2028-01-31T10:00:00Z': '2028-02-29',
    '2026-03-15T09:00:00Z': '2026-04-15',
    '2026-08-31T09:00:00Z': '2026-09-30',
    '2026-12-20T09:00:00Z': '2027-01-20',
  };
  for (const [receivedAt, due] of Object.entries(cases)) {
    assert.strictEqual(normalizeReq({ requestType: 'access', email: 'a@example.de', receivedAt }).deadline, due, receivedAt);
  }
});

test('GDPR is the default, with a two-month extension and no acknowledgment deadline', () => {
  const r = normalizeReq({ requestType: 'access', email: 'a@example.de', receivedAt: '2026-01-31T10:00:00Z' });
  assert.strictEqual(r.jurisdiction, 'GDPR');
  assert.strictEqual(r.extendedDeadline, '2026-04-30', 'three months from receipt, not from the clamped deadline');
  assert.strictEqual(r.acknowledgeBy, '');
  assert.strictEqual(r.legalRef, 'Article 15 GDPR');
  assert.match(r.complaintText, /supervisory authority/);
});

test('CCPA: 45 calendar days, 10 business days to acknowledge, 90 days at most', () => {
  // Friday 6 Nov 2026: 10 business days later is Friday 20 Nov.
  const r = normalizeReq({ jurisdiction: 'ccpa', requestType: 'know', email: 'jane@example.com', receivedAt: '2026-11-06T17:00:00Z' });
  assert.strictEqual(r.jurisdiction, 'CCPA');
  assert.strictEqual(r.requestType, 'access');
  assert.strictEqual(r.deadline, '2026-12-21');
  assert.strictEqual(r.acknowledgeBy, '2026-11-20');
  assert.strictEqual(r.extendedDeadline, '2027-02-04');
  assert.match(r.legalRef, /right to know/);
  assert.match(r.erasureExceptions, /1798\.105\(d\)/);
  assert.match(r.complaintText, /California Privacy Protection Agency/);
});

test('business days skip weekends', () => {
  // Saturday 7 Nov 2026: the count starts Monday 9 Nov, so 10 business days ends Friday 20 Nov.
  assert.strictEqual(normalizeReq({ jurisdiction: 'CCPA', requestType: 'delete', email: 'a@b.com', receivedAt: '2026-11-07T12:00:00Z' }).acknowledgeBy, '2026-11-20');
  // Wednesday 30 Dec 2026 across the year end: ends Wednesday 13 Jan 2027.
  assert.strictEqual(normalizeReq({ jurisdiction: 'CCPA', requestType: 'delete', email: 'a@b.com', receivedAt: '2026-12-30T12:00:00Z' }).acknowledgeBy, '2027-01-13');
});

test('request type aliases map to the same three types', () => {
  const t = (requestType, extra = {}) => normalizeReq({ requestType, email: 'a@b.com', details: 'x', ...extra }).requestType;
  assert.strictEqual(t('Know'), 'access');
  assert.strictEqual(t('deletion'), 'erasure');
  assert.strictEqual(t('rectification'), 'correction');
  assert.strictEqual(t('correct', { jurisdiction: 'CCPA' }), 'correction');
});

test('request is normalized and given an ID', () => {
  const r = normalizeReq({ requestType: ' Erasure ', email: ' Max.Muster@Example.DE ' });
  assert.strictEqual(r.requestType, 'erasure');
  assert.strictEqual(r.email, 'max.muster@example.de');
  assert.match(r.requestId, /^DSAR-\d{8}-[A-Z0-9]{5}$/);
});

test('invalid requests are rejected', () => {
  assert.throws(() => normalizeReq({ requestType: 'delete-everything', email: 'a@b.de' }), /requestType/);
  assert.throws(() => normalizeReq({ requestType: 'access', email: 'not-an-email' }), /email/);
  assert.throws(() => normalizeReq({ jurisdiction: 'TX', requestType: 'access', email: 'a@b.de' }), /jurisdiction must be one of GDPR, CCPA/);
  assert.throws(() => normalizeReq({ requestType: 'correction', email: 'a@b.de' }), /details/);
});

test('inventory records which systems hold the person', () => {
  const refs = {
    'Normalize Request': { requestId: 'DSAR-1', email: 'max@example.de', requestType: 'access' },
    'Find in Slack': { ok: true, user: { id: 'U1', tz: 'Europe/Berlin', profile: { real_name: 'Max' } } },
    'Find in Google Workspace': { error: { code: 404 } },
    'Find in Jira': [{ accountId: 'J1', displayName: 'Max', active: true }],
  };
  const [{ json }] = run(inventory, [{}], refs);
  assert.strictEqual(json.systemsFound, 'Slack, Jira');
  assert.strictEqual(json.slackUserId, 'U1');
  assert.strictEqual(json.hasGoogleAccount, false);
});

test('inventory handles a person found nowhere', () => {
  const refs = {
    'Normalize Request': { requestId: 'DSAR-2', email: 'x@example.de' },
    'Find in Slack': { ok: false, error: 'users_not_found' },
    'Find in Google Workspace': {},
    'Find in Jira': [],
  };
  assert.strictEqual(run(inventory, [{}], refs)[0].json.systemsFound, 'none');
});

test('monitor flags overdue and due-soon requests, overdue first', () => {
  const day = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const rows = [
    { RequestId: 'A', RequestType: 'access', Deadline: day(3), Status: 'Received - awaiting verification' },
    { RequestId: 'B', RequestType: 'erasure', Deadline: day(-2), Status: 'Received - awaiting verification' },
    { RequestId: 'C', RequestType: 'access', Deadline: day(20), Status: 'Received - awaiting verification' },
    { RequestId: 'D', RequestType: 'access', Deadline: day(-5), Status: 'Completed - access fulfilled' },
    { RequestId: 'E', RequestType: 'correction', Deadline: day(-1), Status: 'Completed - corrected', Jurisdiction: 'CCPA' },
    { RequestId: 'F', RequestType: 'erasure', Deadline: day(1), Status: 'Received - awaiting verification', Jurisdiction: 'CCPA' },
  ];
  const [{ json }] = run(atRisk, rows);
  assert.strictEqual(json.count, 3);
  const lines = json.summary.split('\n');
  assert.match(lines[0], /^• B \(GDPR erasure\) .*OVERDUE by 2d/);
  assert.match(lines[1], /^• F \(CCPA erasure\) due in 1d/);
});

test('monitor stays quiet when nothing is at risk', () => {
  const far = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  assert.deepStrictEqual(run(atRisk, [{ RequestId: 'C', Deadline: far, Status: 'Received' }]), []);
});
