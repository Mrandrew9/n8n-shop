# n8n Shop

A collection of practical n8n workflows for IT operations, identity & access management, and workplace automation — built and maintained by [Andrew Yonan](https://linkedin.com/in/Andrew-Yonan).

Each workflow is production-inspired but fully genericized — no proprietary data, internal APIs, or company-specific configuration. Import any `.json` directly into your own n8n instance.

## Workflows

| Workflow | Description | Folder |
|---|---|---|
| Access Request & Approval | Human-in-the-loop IAM access approval with risk-based routing and audit logging | [`/workflows/access-request-approval`](workflows/access-request-approval) |

*More workflows added regularly — see [Issues](../../issues) for the roadmap.*

## Why this exists

Most workflow examples online are toy demos. These are built the way real enterprise IT/IAM automation actually needs to work: with approval gates, error handling, retries, and audit trails — not just "connect A to B."

## How to use

1. Open the workflow folder you want.
2. Import the `workflow.json` into n8n (Workflows → Import from File).
3. Follow the folder's own README for credential setup (Slack, Google Sheets, etc. — you'll need your own).

## License

MIT — use, modify, and share freely. Attribution appreciated but not required.

## Connect

Built by an IT/IAM engineer navigating enterprise automation, identity, and SaaS governance daily. Feedback and workflow requests welcome via Issues.
