# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report privately instead:

- Use GitHub's **"Report a vulnerability"** (Security → Advisories) on this
  repository, or
- Contact the maintainers at **<your-email-or-contact-here>**.

Please include a description, steps to reproduce, affected components, and any
suggested remediation. We will acknowledge your report, keep you updated on
progress, and credit you (if you wish) once a fix is released.

## Scope notes

- Never commit secrets or credentials. Configuration is environment-driven
  (`infra/.env`); only `infra/.env.example` is tracked.
- If you discover a leaked credential in the history, report it privately so it
  can be rotated.
