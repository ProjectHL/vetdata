import type { ClinicProfile, RolePermissions, SharingPolicy, User } from "@/domain/settings";
import type { TaskMeta } from "@/domain/tasks";
import type { SettingsService, TasksService } from "../contracts";
import { apiFetch, NotImplementedError } from "./client";

type TaskItem = { id: string; assignee?: string | null; done: boolean };
type TaskMetaResponse = { id: string; assignee: string | null; done: boolean };

const toMeta = (t: { assignee?: string | null; done?: boolean }): TaskMeta => ({
  assignee: t.assignee ?? undefined,
  done: t.done,
});

export const settings: SettingsService = {
  /** GET /api/v1/me — el backend devuelve {user, clinic, permissions, memberships}. */
  getCurrentUser: () => apiFetch<{ user: User }>("/api/v1/me").then((res) => res.user),
  /** GET /api/v1/users */
  listUsers: () => apiFetch<User[]>("/api/v1/users"),
  /** POST /api/v1/users/invitations */
  inviteUser: (input) => apiFetch<User>("/api/v1/users/invitations", { method: "POST", body: input }),
  /** PATCH /api/v1/users/:id */
  updateUser: (id, patch) =>
    apiFetch<User>(`/api/v1/users/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }),
  /** GET /api/v1/settings/role-permissions */
  getRolePermissions: () => apiFetch<RolePermissions>("/api/v1/settings/role-permissions"),
  /** PUT /api/v1/settings/role-permissions/:role (ruta y método reales del backend) con granted calculado desde el estado actual. */
  togglePermission: async (role, permission): Promise<RolePermissions> => {
    const current = await apiFetch<RolePermissions>("/api/v1/settings/role-permissions");
    const granted = !(current[role] ?? []).includes(permission);
    return apiFetch<RolePermissions>(`/api/v1/settings/role-permissions/${encodeURIComponent(role)}`, {
      method: "PUT",
      body: { permission, granted },
    });
  },
  /** GET /api/v1/settings/clinic-profile */
  getClinicProfile: () => apiFetch<ClinicProfile>("/api/v1/settings/clinic-profile"),
  /** PUT /api/v1/settings/clinic-profile */
  updateClinicProfile: (profile) =>
    apiFetch<ClinicProfile>("/api/v1/settings/clinic-profile", { method: "PUT", body: profile }),
  /** GET /api/v1/settings/sharing-policy — FALTANTE: sin endpoint en el backend. */
  getSharingPolicy: async (): Promise<SharingPolicy> => {
    throw new NotImplementedError("GET /api/v1/settings/sharing-policy");
  },
  /** PUT /api/v1/settings/sharing-policy — FALTANTE: sin endpoint en el backend. */
  updateSharingPolicy: async () => {
    throw new NotImplementedError("PUT /api/v1/settings/sharing-policy");
  },
};

export const tasks: TasksService = {
  /** GET /api/v1/tasks?view=all (el contrato no trae /tasks/meta; se usa la vista completa y se proyecta a Record). */
  listMeta: () =>
    apiFetch<TaskItem[]>("/api/v1/tasks?view=all").then((items) =>
      Object.fromEntries(items.map((t) => [t.id, toMeta(t)])) as Record<string, TaskMeta>,
    ),
  /** PATCH /api/v1/tasks/:taskId (ruta y método reales del backend; el id va URL-encoded porque contiene ":"). */
  assign: (taskId, assignee) =>
    apiFetch<TaskMetaResponse>(`/api/v1/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      body: { assignee },
    }).then((res) => toMeta(res)),
  /** PATCH /api/v1/tasks/:taskId (ruta y método reales del backend). */
  complete: (taskId, done) =>
    apiFetch<TaskMetaResponse>(`/api/v1/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      body: { done },
    }).then((res) => toMeta(res)),
  /** GET /api/v1/reminders — FALTANTE: sin endpoint en el backend (solo existe POST /api/v1/appointments/:id/remind por cita). */
  listReminders: async (): Promise<string[]> => {
    throw new NotImplementedError("GET /api/v1/reminders");
  },
  /** POST /api/v1/patients/:patientId/reminders — FALTANTE: el backend solo expone recordatorio por cita (POST /api/v1/appointments/:id/remind), no por paciente. */
  sendReminder: async () => {
    throw new NotImplementedError("POST /api/v1/patients/:patientId/reminders");
  },
};
