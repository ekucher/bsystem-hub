// Types mirroring the Integration Core contract in
// bsystem-integration-core/docs/openapi.yaml.
//
// The HUB consumes the normalized API only. No upstream field name — an
// EspoCRM `accountId`, a Redmine `identifier` — appears here except where the
// normalized contract itself exposes it.

/** The authenticated user and the access their groups resolve to. */
export type Me = {
  id: string;
  subject: string;
  email: string;
  name: string;
  username: string;
  groups: string[];
  roles: string[];
  permissions: string[];
  modules: string[];
};

export type Module = {
  id: string;
  name: string;
  description: string;
  status: string;
};

/** Fields every normalized entity carries. */
type Normalized = {
  /** The immutable platform Global ID. */
  id: string;
  /** The authoritative system this record came from. */
  source: string;
  /** The identifier within that system. */
  source_id: string;
};

export type Client = Normalized & {
  name: string;
  website?: string;
  email?: string;
  phone?: string;
};

export type Contact = Normalized & {
  name: string;
  /** Absent when the upstream account has no mapping. */
  client_id?: string;
  email?: string;
  phone?: string;
};

export type Project = Normalized & {
  name: string;
  identifier: string;
  description?: string;
};

export type Issue = Normalized & {
  subject: string;
  project_id?: string;
  status?: string;
};

export type Document = Normalized & {
  title: string;
  url?: string;
  collection_id?: string;
  updated_at?: string;
};

/** The pagination block every collection returns. */
export type Pagination = {
  /** The size of the whole collection, not of this page. */
  total: number;
  /** The number of items actually returned. */
  limit: number;
  /** Absent once the collection is exhausted. */
  next_cursor?: string;
};

/** The envelope every collection returns. */
export type Collection<T> = {
  data: T[];
  pagination: Pagination;
};

export type AdapterHealth = {
  status: "ready" | "degraded" | "disabled";
  message?: string;
};
