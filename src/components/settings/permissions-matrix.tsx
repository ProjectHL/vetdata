"use client";

import { Fragment } from "react";
import { Lock } from "lucide-react";
import { Field } from "@/components/care-actions/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PERMISSIONS, ROLES } from "@/domain/settings";
import { type AccessDuration, type AccessScope, DURATIONS, SCOPES } from "@/domain/sharing";
import { useCan, useStore } from "@/lib/store";

const areas = [...new Set(PERMISSIONS.map((p) => p.area))];

export function PermissionsMatrix() {
  const { rolePermissions, togglePermission, role } = useStore();
  const can = useCan();
  const editable = can("usuarios.administrar");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles y permisos</CardTitle>
        <CardDescription>
          {editable
            ? "Los cambios se aplican al instante en todo VetData. Prueba cambiar de rol en el menú del avatar (Ver como)."
            : `Estás viendo como ${role}: solo Admin puede modificar permisos.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Permiso</TableHead>
              {ROLES.map((r) => (
                <TableHead key={r} className="text-center">
                  {r}
                  {r === role && <span className="block text-[10px] font-normal text-primary">(rol activo)</span>}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {areas.map((area) => (
              <Fragment key={area}>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableCell colSpan={ROLES.length + 1} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {area}
                  </TableCell>
                </TableRow>
                {PERMISSIONS.filter((p) => p.area === area).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-normal">
                      <p className="font-medium">{p.label}</p>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    </TableCell>
                    {ROLES.map((r) => {
                      // Admin conserva siempre la administración para no quedar bloqueado.
                      const locked = r === "Admin" && p.id === "usuarios.administrar";
                      return (
                        <TableCell key={r} className="text-center">
                          {locked ? (
                            <Lock className="mx-auto size-4 text-muted-foreground" aria-label="Siempre habilitado" />
                          ) : (
                            <Checkbox
                              checked={rolePermissions[r].includes(p.id)}
                              disabled={!editable}
                              onCheckedChange={() => togglePermission(r, p.id)}
                              aria-label={`${p.label} para ${r}`}
                            />
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function SharingPolicyCard() {
  const { sharingPolicy, setSharingPolicy } = useStore();
  const can = useCan();
  const editable = can("usuarios.administrar");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Política de compartición en la red</CardTitle>
        <CardDescription>
          Valores por defecto al solicitar o aprobar accesos a fichas entre clínicas.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="Alcance por defecto">
          <Select
            value={sharingPolicy.defaultScope}
            disabled={!editable}
            onValueChange={(v) => setSharingPolicy({ ...sharingPolicy, defaultScope: v as AccessScope })}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SCOPES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Vigencia por defecto">
          <Select
            value={String(sharingPolicy.defaultDuration)}
            disabled={!editable}
            onValueChange={(v) =>
              setSharingPolicy({ ...sharingPolicy, defaultDuration: v === "null" ? null : (Number(v) as AccessDuration) })
            }
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DURATIONS.map((d) => (
                <SelectItem key={String(d.value)} value={String(d.value)}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-start gap-2 sm:col-span-2">
          <Checkbox
            id="pol-consent"
            checked={sharingPolicy.requireConsent}
            disabled={!editable}
            onCheckedChange={(v) => setSharingPolicy({ ...sharingPolicy, requireConsent: v === true })}
          />
          <Label htmlFor="pol-consent" className="leading-snug font-normal">
            Exigir confirmar la autorización del dueño al aprobar, si no tiene consentimiento registrado
          </Label>
        </div>
        <div className="flex items-start gap-2 sm:col-span-2">
          <Checkbox
            id="pol-notify"
            checked={sharingPolicy.notifyRequests}
            disabled={!editable}
            onCheckedChange={(v) => setSharingPolicy({ ...sharingPolicy, notifyRequests: v === true })}
          />
          <Label htmlFor="pol-notify" className="leading-snug font-normal">
            Notificar nuevas solicitudes en la campana
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}
