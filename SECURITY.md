# Security Policy

## Security model

BSYSTEM-HUB relies on authentik for identity and OIDC authentication. Authorization decisions must be enforced by backend services.

## Mandatory rules

- HTTPS only in production.
- No local password storage in HUB.
- MFA is controlled through authentik policies.
- Never treat hidden UI elements as an authorization control.
- Never commit secrets, tokens, passwords, private keys, or production credentials.
- Service-to-service access must use dedicated service identities.
- Every sensitive action must be auditable.
- Tenant/customer scope must be validated server-side.
- AI requests must pass through permission checks and data-redaction policies.

## Security-sensitive data

The following data must never be sent to an LLM without explicit approved policy:

- passwords;
- API keys;
- private keys;
- session tokens;
- authentication cookies;
- unredacted secrets;
- credentials embedded in logs.

## Reporting

Do not publish exploitable security findings in public issues. Use the repository owner's private security contact/process when configured.
