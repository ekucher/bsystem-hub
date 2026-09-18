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
  launch_url?: string;
  icon?: string;
};

/** A human identity persisted by Integration Core after first authentication. */
export type HumanIdentity = {
  /** Immutable platform Global User ID. */
  id: string;
  /** Stable OIDC subject issued by authentik. */
  subject: string;
  email: string;
  display_name: string;
  username: string;
  groups: string[];
  first_seen_at: string;
  last_seen_at: string;
};

export type HumanRole = "admin" | "manager" | "developer" | "qa" | "support" | "devops" | "customer";

export type HumanAccount = {
  authentik_id?: number;
  global_id?: string;
  username: string;
  name: string;
  email: string;
  active?: boolean;
  roles: HumanRole[];
  groups: string[];
  first_seen_at?: string;
  last_seen_at?: string;
  manageable: boolean;
  password_manageable: boolean;
};

export type HumanAccountList = {
  management_available: boolean;
  accounts: HumanAccount[];
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

/**
 * A platform notification.
 *
 * Addressing is either `recipient_id` (one person) or `audience_permission`
 * (everyone who holds a permission); exactly one is set. The HUB never decides
 * which notifications a user may see — the Integration Core filters the
 * collection to the caller before it is returned.
 */
export type Notification = {
  id: number;
  event: string;
  source: string;
  severity: "debug" | "info" | "warning" | "error" | "critical";
  title: string;
  body?: string;
  /** A HUB path, absent when the platform has no page for the entity. */
  deep_link?: string;
  entity_id?: string;
  tenant_id?: string;
  recipient_id?: string;
  audience_permission?: string;
  correlation_id?: string;
  occurred_at: string;
  /** Whether this user has marked it read. Read state is per user. */
  read: boolean;
};

/** The notification collection envelope, which also carries the counts. */
export type NotificationCollection = Collection<Notification> & {
  /**
   * Notifications visible to this user that they have not read. It describes
   * the whole collection rather than the page, so a badge does not have to
   * walk the history to draw a number.
   */
  unread_count: number;
};
