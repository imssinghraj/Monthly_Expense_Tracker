export const DEFAULT_ORGANIZATION = {
  id: "personal",
  name: "Personal Workspace",
  plan: "free",
  roles: {
    owner: ["*"],
    admin: ["expenses:read", "expenses:write", "settings:write"],
    member: ["expenses:read", "expenses:write"],
    viewer: ["expenses:read"]
  }
};

export function createPersonalOrganization(user) {
  return {
    ...DEFAULT_ORGANIZATION,
    ownerUid: user?.uid || null,
    members: user?.uid ? [{ uid: user.uid, role: "owner" }] : []
  };
}

export function can(role = "viewer", permission = "expenses:read", organization = DEFAULT_ORGANIZATION) {
  const permissions = organization.roles?.[role] || [];
  return permissions.includes("*") || permissions.includes(permission);
}
