# BSYSTEM Global ID Specification

## Purpose

Global IDs provide stable cross-system identity without coupling modules to source-system primary keys or names.

## Format

```text
PREFIX-NNNNNN
```

Initial prefixes:

- `USR-` User
- `CL-` Client
- `CT-` Contact
- `PR-` Project
- `TSK-` Task
- `SRV-` Server
- `APP-` Application
- `INC-` Incident
- `TST-` Test Case
- `BUG-` Bug
- `DOC-` Document
- `REL-` Release
- `REP-` Repository

Examples:

```text
CL-000042
PR-000103
SRV-000017
DOC-000455
```

## Rules

1. IDs are immutable after assignment.
2. IDs are unique per entity type and globally unambiguous because of the prefix.
3. Human-readable names never replace IDs in integrations.
4. Source-system IDs remain stored as mappings.
5. Deleted entities do not cause IDs to be reused.
6. IDs are not secrets.

## Mapping model

Example:

```json
{
  "global_id": "PR-000103",
  "entity_type": "project",
  "source": "redmine",
  "source_id": "428"
}
```

A single global entity may have mappings in several systems:

```json
{
  "global_id": "CL-000042",
  "mappings": [
    {"source":"espocrm","source_id":"65fa..."},
    {"source":"redmine","source_id":"22"},
    {"source":"outline","source_id":"collection-..."}
  ]
}
```

## Ownership

The Integration Core owns cross-system mappings and ID allocation rules. The authoritative business attributes remain in the source-of-truth system.

## Do not use

The following are NOT valid cross-system identifiers:

- customer name
- hostname alone
- email address alone
- Redmine numeric ID alone
- database primary key from another module

## API behavior

Public BSYSTEM APIs should prefer global IDs in routes and payloads:

```http
GET /api/v1/clients/CL-000042
GET /api/v1/projects/PR-000103
```

Adapters translate global IDs to source-system IDs internally.

## Future considerations

If scale or external interoperability requires it, the numeric sequence may be replaced or supplemented by UUID/ULID internally while preserving the stable public BSYSTEM ID.
