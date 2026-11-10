# n8n Shop

![validate-workflows](https://github.com/Mrandrew9/n8n-shop/actions/workflows/validate.yml/badge.svg)
![n8n](https://img.shields.io/badge/n8n-workflows-EA4B71?logo=n8n&logoColor=white)
![IAM](https://img.shields.io/badge/focus-IAM%20%26%20IT%20ops-2B6CB0)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

A collection of practical n8n workflows for IT operations, identity & access management, and workplace automation — built and maintained by [Andrew Yonan](https://linkedin.com/in/Andrew-Yonan).

Each workflow is production-inspired but fully genericized — no proprietary data, internal APIs, or company-specific configuration. Import any `.json` directly into your own n8n instance.

## Workflows

| Workflow | Description | Folder |
|---|---|---|
| Privacy Requests (GDPR + CCPA) | Access, erasure and correction requests across Slack, Google Workspace and Jira under GDPR or California's CCPA: jurisdiction rules table, identity check, deadline tracking, DPO approval gate, register | [`/workflows/gdpr-dsar`](workflows/gdpr-dsar) |
| Access Request & Approval | Human-in-the-loop IAM access approval with risk-based routing and audit logging | [`/workflows/access-request-approval`](workflows/access-request-approval) |

*More workflows added regularly — see [Issues](../../issues) for the roadmap.*

## Why this exists

Most workflow examples online are toy demos. These are built the way real enterprise IT/IAM automation actually needs to work: with approval gates, error handling, retries, and audit trails — not just "connect A to B."

## How to use

1. Open the workflow folder you want.
2. Import its `.json` file(s) into n8n (Workflows → Import from File).
3. Follow the folder's own README for credential setup (Slack, Google Sheets, etc. — you'll need your own).

## Quality checks

Every push runs [`validate-workflows`](.github/workflows/validate.yml):

- `scripts/validate_workflows.py` checks that each workflow is valid JSON, every connection points at a real node, every node is reachable from a trigger, Code nodes are valid JavaScript, and no secrets are hardcoded.
- `tests/` unit-tests the JavaScript inside Code nodes, read straight from the workflow files.

All workflows also import cleanly into n8n 2.46.7, and every node parameter checks out against n8n's own node definitions.

```bash
python scripts/validate_workflows.py
node --test tests/*.test.js
```

## License

MIT — use, modify, and share freely. Attribution appreciated but not required.

## Connect

Built by an IT/IAM engineer navigating enterprise automation, identity, and SaaS governance daily. Feedback and workflow requests welcome via Issues.
