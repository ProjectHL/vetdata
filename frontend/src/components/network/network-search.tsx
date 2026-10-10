"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, Lock, Search, Send } from "lucide-react";
import { Guard } from "@/components/settings/guard";
import { SpeciesIcon } from "@/components/patients/species-icon";
import { AccessBadge } from "@/components/sharing/access-badge";
import { RequestAccessDialog } from "@/components/sharing/request-access-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { type Owner, ownerName } from "@/domain/owners";
import { type Patient } from "@/domain/patients";
import { accessLevel } from "@/domain/sharing";
import { formatDate, formatRut, normalizeRut } from "@/lib/format";
import { useCurrentClinic, useOwners, usePatients } from "@/lib/server-state";
import { useStore } from "@/lib/store";

const EXAMPLES = ["12764509-4", "17398220-8", "15620948-1"];

function findOwner(owners: Owner[], input: string): Owner | undefined {
  const r = normalizeRut(input.trim());
  if (!r) return undefined;
  return owners.find((o) => o.rut === r || o.rut.split("-")[0] === r);
}

export function NetworkSearch({ initialRut = "" }: { initialRut?: string }) {
  const { grants, requests } = useStore();
  const owners = useOwners();
  const patients = usePatients();
  const currentClinic = useCurrentClinic();
  const [input, setInput] = useState(initialRut);
  const [searched, setSearched] = useState(initialRut);
  const [selected, setSelected] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const owner = searched ? findOwner(owners, searched) : undefined;
  const petsOf = (ownerRut: string) => patients.filter((p) => p.ownerRut === ownerRut);
  const pets = owner ? petsOf(owner.rut) : [];
  const levelOf = (p: Patient) => accessLevel(p, grants, currentClinic).level;
  const pendingOf = (p: Patient) =>
    requests.find((r) => r.patientId === p.id && r.from === currentClinic && r.status === "Pendiente");
  const canSeeContact = pets.some((p) => levelOf(p) !== "ninguno");
  const byClinic = [...new Set(pets.map((p) => p.clinic))].map(
    (clinic) => [clinic, pets.filter((p) => p.clinic === clinic)] as const
  );

  const search = (value: string) => {
    setInput(formatInput(value));
    setSearched(value);
    setSelected([]);
    setNotice("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buscar en la red por RUT del dueño</CardTitle>
        <CardDescription>
          Trae a tu clínica los datos de un dueño y sus mascotas registradas en otras clínicas.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            search(input);
          }}
        >
          <Input aria-label="RUT del propietario" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ej. 12.764.509-4" className="sm:max-w-xs" />
          <Button type="submit"><Search /> Buscar</Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Prueba con:{" "}
          {EXAMPLES.map((r, i) => (
            <span key={r}>
              {i > 0 && " · "}
              <button type="button" className="text-primary tabular-nums hover:underline" onClick={() => search(r)}>
                {formatRut(r)}
              </button>
            </span>
          ))}
        </p>

        {searched && !owner && (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No hay dueños con el RUT {searched} en la red.
          </p>
        )}

        {owner && (
          <div className="flex flex-col gap-4 rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">{ownerName(owner)}</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  RUT {formatRut(owner.rut)} · {owner.sector}
                </p>
                <p className="mt-1 text-sm">
                  {canSeeContact ? (
                    <>
                      {owner.phone} · {owner.email}{" "}
                      <Link href={`/pacientes/propietarios/${owner.rut}`} className="text-primary hover:underline">
                        Ver propietario
                      </Link>
                    </>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Lock className="size-3" /> Datos de contacto visibles al obtener acceso
                    </span>
                  )}
                </p>
              </div>
              <Guard permission="red.solicitar">
                <Button disabled={selected.length === 0} onClick={() => setDialogOpen(true)}>
                  <Send /> Solicitar acceso ({selected.length})
                </Button>
              </Guard>
            </div>

            {notice && <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{notice}</p>}

            {byClinic.map(([clinic, list]) => (
              <div key={clinic} className="flex flex-col gap-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {clinic} {clinic === currentClinic && "(tu clínica)"}
                </p>
                {list.map((p) => {
                  const level = levelOf(p);
                  const pending = pendingOf(p);
                  const selectable = level === "ninguno" && !pending;
                  return (
                    <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 p-3">
                      {selectable ? (
                        <Checkbox
                          checked={selected.includes(p.id)}
                          onCheckedChange={(v) =>
                            setSelected((prev) => (v === true ? [...prev, p.id] : prev.filter((id) => id !== p.id)))
                          }
                          aria-label={`Seleccionar ${p.name}`}
                        />
                      ) : (
                        <span className="size-4" />
                      )}
                      <SpeciesIcon species={p.species} className="size-4 text-primary" />
                      <span className="font-medium">{p.name}</span>
                      <span className="text-sm text-muted-foreground">{p.species}</span>
                      <span className="ml-auto flex flex-wrap items-center gap-2">
                        {pending ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="size-3" /> Solicitud pendiente desde {formatDate(pending.date)}
                          </span>
                        ) : (
                          <AccessBadge level={level} />
                        )}
                        {level !== "ninguno" && (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/pacientes/historial/${p.id}`}>Ver ficha</Link>
                          </Button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <RequestAccessDialog
          patientIds={selected}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSent={(count) => {
            setSelected([]);
            setNotice(`${count} ${count === 1 ? "solicitud enviada" : "solicitudes enviadas"}. Revisa su estado en Clínicas › Solicitudes.`);
          }}
        />
      </CardContent>
    </Card>
  );
}

function formatInput(value: string) {
  const r = normalizeRut(value);
  return /^\d{7,8}-[\dK]$/.test(r) ? formatRut(r) : value;
}
