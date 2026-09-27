import type { HumanRole } from "../api/types";

/**
 * Shared between the user directory (Users.tsx) and module administration
 * (Modules.tsx) — both present the same set of platform roles, and a role's
 * label is a fact about the role, not about either page.
 */
export const ROLE_LABELS: Record<HumanRole, string> = {
  admin: "Адміністратор",
  manager: "Менеджер",
  developer: "Розробник",
  qa: "QA",
  support: "Підтримка",
  devops: "DevOps",
  customer: "Клієнт",
};

export const HUMAN_ROLES = Object.keys(ROLE_LABELS) as HumanRole[];
