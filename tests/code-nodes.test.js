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

test('deadline is one calendar month, clamped to month end', () => {
  const cases = {
    '2026-01-31T10:00:00Z': '2026-02-28',
    '2028-01-31T10:00:00Z': '2028-02-29',
    '2026-03-15T09:00:00Z': '2026-04-15',
    '2026-08-31T09:00:00Z': '2026-09-30',
    '2026-12-20T09:00:00Z': '2027-01-20',
  };
  for (const [receivedAt, due] of Object.entries(cases)) {
    const [{ json }] = run(normalize, [{ body: { requestType: 'access', email: 'a@example.de', receivedAt } }]);
    assert.strictEqual(json.deadline, due, receivedAt);
  }
});

test('request is normalized and given an ID', () => {
  const [{ json }] = run(normalize, [{ body: { requestType: ' Erasure ', email: ' Max.Muster@Example.DE ' } }]);
  assert.strictEqual(json.requestType, 'erasure');
  assert.strictEqual(json.email, 'max.muster@example.de');
  assert.match(json.requestId, /^DSAR-\d{8}-[A-Z0-9]{5}$/);
});

test('invalid requests are rejected', () => {
  assert.throws(() => run(normalize, [{ body: { requestType: 'delete-everything', email: 'a@b.de' } }]), /requestType/);
  assert.throws(() => run(normalize, [{ body: { requestType: 'access', email: 'not-an-email' } }]), /email/);
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
  ];
  const [{ json }] = run(atRisk, rows);
  assert.strictEqual(json.count, 2);
  assert.match(json.summary.split('\n')[0], /^• B .*OVERDUE by 2d/);
});

test('monitor stays quiet when nothing is at risk', () => {
  const far = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  assert.deepStrictEqual(run(atRisk, [{ RequestId: 'C', Deadline: far, Status: 'Received' }]), []);
});
