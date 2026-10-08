"use client";

import { useState } from "react";
import { CheckCircle2, CircleSlash, Mail, UserPlus } from "lucide-react";
import { Field } from "@/components/care-actions/field";
import { Guard } from "@/components/settings/guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { ROLES, type Role, type UserStatus } from "@/domain/settings";
import { useCan, useStore } from "@/lib/store";

const statusVariant: Record<UserStatus, "default" | "secondary" | "outline"> = {
  Activo: "default",
  Invitado: "secondary",
  Inactivo: "outline",
};

const statusIcon: Record<UserStatus, React.ComponentType<{ className?: string }>> = {
  Activo: CheckCircle2,
  Invitado: Mail,
  Inactivo: CircleSlash,
};

export function UsersTable() {
  const { users, updateUser, currentUser } = useStore();
  const can = useCan();
  const admin = can("usuarios.administrar");
  const [inviting, setInviting] = useState(false);
  const counts = ROLES.map((r) => ({ role: r, n: users.filter((u) => u.role === r && u.status === "Activo").length }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {counts.map((c) => (
          <Badge key={c.role} variant="outline">{c.role}: {c.n}</Badge>
        ))}
        <div className="ml-auto">
          <Guard permission="usuarios.administrar">
            <Button onClick={() => setInviting(true)}><UserPlus /> Invitar usuario</Button>
          </Guard>
        </div>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Especialidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último acceso</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">
                      {u.name} {u.id === currentUser.id && <Badge variant="secondary" className="ml-1">Tú</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>
                    {admin && u.id !== currentUser.id ? (
                      <Select value={u.role} onValueChange={(v) => updateUser(u.id, { role: v as Role })}>
                        <SelectTrigger aria-label={`Rol de ${u.name}`} size="sm" className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      u.role
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.specialty ?? "—"}</TableCell>
                  <TableCell><UserStatusBadge status={u.status} /></TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{u.lastAccess}</TableCell>
                  <TableCell className="text-right">
                    {u.id !== currentUser.id && (
                      <Guard permission="usuarios.administrar">
                        {u.status === "Inactivo" ? (
                          <Button size="sm" variant="outline" onClick={() => updateUser(u.id, { status: "Activo" })}>Reactivar</Button>
                        ) : u.status === "Invitado" ? (
                          <Button size="sm" variant="ghost" onClick={() => updateUser(u.id, { status: "Activo" })}>Marcar aceptada</Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => updateUser(u.id, { status: "Inactivo" })}>
                            Desactivar
                          </Button>
                        )}
                      </Guard>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Los veterinarios activos son los que aparecen en el mapa de Actividad y al agendar horas.
          </p>
        </CardContent>
      </Card>

      <InviteDialog open={inviting} onOpenChange={setInviting} />
    </div>
  );
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { inviteUser } = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("Veterinario");
  const [specialty, setSpecialty] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invitar usuario</DialogTitle>
          <DialogDescription>Recibirá un correo para activar su cuenta en VetData.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Nombre" htmlFor="iv-name"><Input id="iv-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Email" htmlFor="iv-email"><Input id="iv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Rol">
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Especialidad" htmlFor="iv-spec">
              <Input id="iv-spec" value={specialty} onChange={(e) => setSpecialty(e.target.value)} disabled={role !== "Veterinario"} />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!name.trim() || !email.includes("@")}
            onClick={() => {
              inviteUser({ name: name.trim(), email: email.trim(), role, specialty: role === "Veterinario" ? specialty || undefined : undefined });
              setName("");
              setEmail("");
              setSpecialty("");
              onOpenChange(false);
            }}
          >
            Enviar invitación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserStatusBadge({ status }: { status: UserStatus }) {
  const Icon = statusIcon[status];
  return (
    <Badge variant={statusVariant[status]}>
      <Icon /> {status}
    </Badge>
  );
}
