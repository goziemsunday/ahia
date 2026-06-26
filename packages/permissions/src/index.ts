import {
  createAccessControl,
  type AccessControl,
} from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

const statement = {
  ...defaultStatements,
  product: ["create", "view", "update", "delete"],
  category: ["create", "view", "update", "delete"],
  order: ["view-user", "view-all"],
} as const;

export const ac = createAccessControl(statement) as AccessControl;

export const user = ac.newRole({
  product: ["view"],
  category: ["view"],
  order: ["view-user"],
});

export const admin = ac.newRole({
  user: ["list", "ban", "set-password", "update", "impersonate"],
  session: adminAc.statements.session,
  product: ["create", "view", "update", "delete"],
  category: ["create", "view", "update", "delete"],
  order: ["view-user", "view-all"],
});

export const superadmin = ac.newRole({
  user: adminAc.statements.user,
  session: adminAc.statements.session,
  product: ["create", "view", "update", "delete"],
  category: ["create", "view", "update", "delete"],
  order: ["view-user", "view-all"],
});
