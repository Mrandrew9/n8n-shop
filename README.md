# Employee Access Request & Approval Workflow

## What it does
Simulates a real IAM governance process:
1. **Trigger** – webhook receives an access request (requester, app, access level, justification)
2. **Route by risk** – sensitive/admin requests go to a security-lead approval channel; standard requests go to a general IT approver channel
3. **Human-in-the-loop approval** – workflow pauses (Wait node) until an approver replies APPROVE or REJECT
4. **Provision or deny** – approved requests call a mock IAM API to grant access; rejected requests notify the requester
5. **Audit logging** – every decision (approved or rejected) is logged to a Google Sheet for compliance/audit evidence

This directly mirrors the n8n job posting's language: "human approval steps for sensitive decisions," "access reviews, audit evidence collection," "retries... error handling."

## How to import into n8n
1. Log into your n8n Cloud account (app.n8n.cloud) or self-hosted instance.
2. Click **Add workflow** → **⋮ menu** → **Import from File**.
3. Select `Access_Request_Approval_Workflow.json`.
4. The full workflow will appear on the canvas with all nodes connected.

## Before you can run it live
- **Slack node**: connect your own Slack workspace credential (or a free test workspace), and replace `security-approvals` / `it-approvals` with real channel names.
- **HTTP Request node**: this points to a placeholder `IAM_API_BASE_URL` — you don't need a real IAM system to demo it. For a screenshot, you can leave it unconfigured/greyed out, or point it at a free mock API (e.g., webhook.site) just to show the call firing.
- **Google Sheets node**: connect a Google account and create a simple sheet with columns like `Requester | App | Level | Decision | Timestamp` for the audit log.

## For your purposes

**1. n8n job application screenshot:**
Trigger the workflow manually with test data (n8n lets you "Execute Workflow" with sample input), then screenshot the canvas mid-execution showing the branching logic and green checkmarks. This is exactly the kind of "first workflow" they ask applicants to share.

**2. LinkedIn post:**
Good framing: *"Applying to n8n's IT Systems & Automation Engineer role, so I decided to practice what I'd actually be building — an access request approval workflow with human-in-the-loop governance and audit logging. Here's what it looks like."* Attach a screenshot of the canvas. This signals initiative and genuine product familiarity, not just a resume line.

**3. Template marketplace:**
n8n's template gallery (n8n.io/workflows) accepts community submissions. Genericize the Slack channel names and IAM API placeholder further, add a short description emphasizing "IT access governance" and "audit-ready," and submit. Templates with real-world enterprise use cases (vs. toy demos) tend to get more traction.

## Notes
- No CrowdStrike-specific configuration, internal API details, or proprietary information is included anywhere in this workflow — it's built generically so it's safe to publish publicly.
- If you want a second workflow (e.g., onboarding notification, or SaaS account reconciliation) for variety across the three use cases, let me know and I'll build another.
