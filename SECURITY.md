# Security policy

## Support status

The hosted website and studio are a private prototype. The current `main`
branch receives best-effort security fixes. Forks, modified deployments, and
old snapshots are unsupported.

## Reporting a vulnerability

Do not disclose vulnerabilities in a public issue, discussion, pull request,
chat, screenshot, or log paste.

Use the repository's **Security → Advisories → Report a vulnerability** flow.
If private reporting is unavailable, open a minimal public issue asking the
maintainers to establish a private channel; include no exploit details.

Useful reports include a sanitized impact statement, affected commit or URL,
prerequisites, reproduction, affected role, and suggested mitigation. Never
include credentials, cookies, private records, raw workbook content, database
dumps, or unrelated personal data.

## Security-sensitive areas

- GitHub OAuth callback and redirect validation;
- stable numeric-ID allowlisting and active membership checks;
- Supabase RLS, grants, privileged functions, and Storage policies;
- draft/public separation and private-note exclusion;
- optimistic concurrency and immutable revisions;
- publication bundle hashes, Git ancestry, file hashes, and reconciliation;
- Supabase secret-key transport and redirect handling;
- preview deployments and environment-variable scoping;
- backup encryption and restore procedures;
- workbook quarantine, imports, and repository hygiene guards; and
- asset rights status and private/public delivery.

The service-role or secret key must never reach a browser, redirect target,
log, preview deployment, or public repository. Hosted Supabase origins must use
HTTPS; HTTP is accepted only for exact loopback development hosts.

## Disclosure

Maintainers will make a best effort to acknowledge, reproduce, assess, fix,
and coordinate disclosure. This policy does not authorize testing against
accounts, databases, deployments, or systems without their owners' permission.
