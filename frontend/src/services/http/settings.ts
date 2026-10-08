import type { SettingsService, TasksService } from "../contracts";
import { NotImplementedError } from "./client";

export const settings: SettingsService = {
  /** GET /api/v1/me */
  getCurrentUser: async () => {
    throw new NotImplementedError("GET /api/v1/me");
  },
  /** GET /api/v1/users */
  listUsers: async () => {
    throw new NotImplementedError("GET /api/v1/users");
  },
  /** POST /api/v1/users/invitations */
  inviteUser: async () => {
    throw new NotImplementedError("POST /api/v1/users/invitations");
  },
  /** PATCH /api/v1/users/:id */
  updateUser: async () => {
    throw new NotImplementedError("PATCH /api/v1/users/:id");
  },
  /** GET /api/v1/settings/role-permissions */
  getRolePermissions: async () => {
    throw new NotImplementedError("GET /api/v1/settings/role-permissions");
  },
  /** POST /api/v1/settings/role-permissions/:role/toggle */
  togglePermission: async () => {
    throw new NotImplementedError("POST /api/v1/settings/role-permissions/:role/toggle");
  },
  /** GET /api/v1/settings/clinic-profile */
  getClinicProfile: async () => {
    throw new NotImplementedError("GET /api/v1/settings/clinic-profile");
  },
  /** PUT /api/v1/settings/clinic-profile */
  updateClinicProfile: async () => {
    throw new NotImplementedError("PUT /api/v1/settings/clinic-profile");
  },
  /** GET /api/v1/settings/sharing-policy */
  getSharingPolicy: async () => {
    throw new NotImplementedError("GET /api/v1/settings/sharing-policy");
  },
  /** PUT /api/v1/settings/sharing-policy */
  updateSharingPolicy: async () => {
    throw new NotImplementedError("PUT /api/v1/settings/sharing-policy");
  },
};

export const tasks: TasksService = {
  /** GET /api/v1/tasks/meta */
  listMeta: async () => {
    throw new NotImplementedError("GET /api/v1/tasks/meta");
  },
  /** PUT /api/v1/tasks/:taskId/assignee */
  assign: async () => {
    throw new NotImplementedError("PUT /api/v1/tasks/:taskId/assignee");
  },
  /** PUT /api/v1/tasks/:taskId/done */
  complete: async () => {
    throw new NotImplementedError("PUT /api/v1/tasks/:taskId/done");
  },
  /** GET /api/v1/reminders */
  listReminders: async () => {
    throw new NotImplementedError("GET /api/v1/reminders");
  },
  /** POST /api/v1/patients/:patientId/reminders */
  sendReminder: async () => {
    throw new NotImplementedError("POST /api/v1/patients/:patientId/reminders");
  },
};
