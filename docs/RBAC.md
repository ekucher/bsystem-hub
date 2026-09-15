# BSYSTEM RBAC Model

## Principle

authentik answers **who the user is**. BSYSTEM-HUB answers **what the user may do**. Each module backend enforces the final decision for its resources.

```text
Identity -> Group -> Role -> Permission -> Scope -> Resource
```

## Initial groups

- `BSYSTEM-Admins`
- `BSYSTEM-Managers`
- `BSYSTEM-Developers`
- `BSYSTEM-QA`
- `BSYSTEM-Support`
- `BSYSTEM-Customers`

Groups originate in authentik and are delivered through OIDC claims.

## Initial roles

### Administrator
Full platform administration. Does not automatically bypass tenant isolation in downstream systems unless explicitly designed.

### Manager
Business overview, clients/projects/reports, read access to operational and quality status.

### Developer
Projects, development, QA read/write as appropriate, Wiki read/write, limited Operations read.

### QA
QA full, Projects read/write as needed, Development read, Wiki read/write.

### Support
CRM client/contact read, Support full, Operations read, Wiki read, Projects read.

### Customer
Customer Portal only, constrained to assigned client scope.

## Permission naming

Format:

```text
module.resource.action
```

Examples:

- `crm.client.read`
- `crm.client.edit`
- `projects.task.read`
- `projects.task.create`
- `projects.task.edit`
- `qa.testcase.read`
- `qa.testcase.execute`
- `development.repo.read`
- `development.pr.create`
- `wiki.document.read`
- `wiki.document.edit`
- `operations.server.read`
- `support.incident.manage`
- `admin.rbac.manage`

## Scopes

Roles describe capability; scopes limit the affected data.

Example:

```json
{
  "role": "Developer",
  "scopes": {
    "projects": ["PR-000103", "PR-000118"]
  }
}
```

Customer example:

```json
{
  "role": "Customer",
  "scopes": {
    "clients": ["CL-000042"]
  }
}
```

The backend MUST reject access to another client even if the caller crafts the URL manually.

## Initial group-to-role mapping

| authentik group | HUB role |
|---|---|
| BSYSTEM-Admins | Administrator |
| BSYSTEM-Managers | Manager |
| BSYSTEM-Developers | Developer |
| BSYSTEM-QA | QA |
| BSYSTEM-Support | Support |
| BSYSTEM-Customers | Customer |

Mappings are configuration, not hard-coded authorization logic.

## Enforcement rules

1. UI hiding is not security.
2. Every protected backend endpoint evaluates permission and scope.
3. Service-to-service identities use separate credentials from human users.
4. Denied administrative and sensitive operations are auditable.
5. Permissions are additive unless an explicit deny model is introduced later.
6. Default is deny.

## Administration split

### authentik
- users
- groups
- MFA
- login flows
- OIDC applications/providers
- service accounts

### BSYSTEM-HUB
- roles
- permissions
- group-role mappings
- client/project scopes
- module access
- audit views

## Future extensions

- temporary roles
- delegated administration
- project-level role overrides
- customer sub-users
- approval workflows
- ABAC conditions for environment, criticality and time-bound access
