import type { User } from "@/domain/settings";
import type { SettingsService, TasksService } from "../contracts";
import { actor, db, mockId, notFound, ok, patchById } from "./db";

export const settings: SettingsService = {
  getCurrentUser: () => ok(actor()),
  listUsers: () => ok(db.users),
  inviteUser: (input) => {
    const user: User = { ...input, id: mockId("u"), status: "Invitado", lastAccess: "—" };
    db.users.push(user);
    return ok(user);
  },
  updateUser: (id, patch) => {
    const user = patchById(db.users, id, (u) => ({ ...u, ...patch }));
    return user ? ok(user) : notFound("Usuario", id);
  },
  getRolePermissions: () => ok(db.rolePermissions),
  togglePermission: (role, permission) => {
    const current = db.rolePermissions[role];
    db.rolePermissions = {
      ...db.rolePermissions,
      [role]: current.includes(permission) ? current.filter((p) => p !== permission) : [...current, permission],
    };
    return ok(db.rolePermissions);
  },
  getClinicProfile: () => ok(db.clinicProfile),
  updateClinicProfile: (profile) => {
    db.clinicProfile = profile;
    return ok(profile);
  },
  getSharingPolicy: () => ok(db.sharingPolicy),
  updateSharingPolicy: (policy) => {
    db.sharingPolicy = policy;
    return ok(policy);
  },
};

export const tasks: TasksService = {
  listMeta: () => ok(db.taskMeta),
  assign: (taskId, assignee) => {
    db.taskMeta[taskId] = { ...db.taskMeta[taskId], assignee };
    return ok(db.taskMeta[taskId]);
  },
  complete: (taskId, done) => {
    db.taskMeta[taskId] = { ...db.taskMeta[taskId], done };
    return ok(db.taskMeta[taskId]);
  },
  listReminders: () => ok(db.reminders),
  sendReminder: (patientId) => {
    if (!db.reminders.includes(patientId)) db.reminders.push(patientId);
    return Promise.resolve();
  },
};
