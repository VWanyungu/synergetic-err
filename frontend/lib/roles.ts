/** Roles that work inside one department. A Department Lead has a Risk Champion's permissions. */
export const DEPARTMENT_ROLES = ["Risk Champion", "Department Lead"];

/** A Division Lead is read-only and limited to their division's register, unless they also hold a wider role. */
export const isDivisionLead = (roles: string[]) => roles.includes("Division Lead") && !roles.some((r) => r === "Admin" || r === "Risk Officer" || DEPARTMENT_ROLES.includes(r));
