import { PageContainer } from "@/components/layout/page-container";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Building2, CheckCircle2, Clock, Phone, Stethoscope } from "lucide-react";
import { CareActionButtons } from "@/components/care-actions/patient-quick-view";
import { AppointmentsTable, InvoicesTable, ReferralsTable } from "@/components/care-actions/records";
import { RequirePermission } from "@/components/settings/guard";
import { AccessGate } from "@/components/sharing/access-gate";
import { SpeciesIcon } from "@/components/patients/species-icon";
import { StatusBadge } from "@/components/patients/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getOwner, getPatient } from "@/lib/lookups";
import { ownerName } from "@/domain/owners";
import { patientAge } from "@/domain/patients";
import { daysUntil, formatDate, formatRut } from "@/lib/format";
import { EmptyState } from "@/components/layout/empty-state";

export default async function FichaPage(props: PageProps<"/pacientes/historial/[id]">) {
  const { id } = await props.params;
  const patient = getPatient(id);
  if (!patient) notFound();
  const owner = getOwner(patient.ownerRut)!;

  const consultations = [...patient.consultations].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <AccessGate patientId={patient.id}>
      <PageContainer>
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/pacientes/historial"><ArrowLeft /> Volver al historial</Link>
        </Button>

        {/* Cabecera de ficha */}
        <Card>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <div className="flex items-center gap-4">
                <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <SpeciesIcon species={patient.species} className="size-8" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">{patient.name}</h1>
                    <StatusBadge status={patient.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {patient.species} · {patient.breed} · {patient.sex} · {patientAge(patient)} · {patient.color}
                  </p>
                </div>
              </div>
  
              <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                <Field label="Peso" value={`${patient.weightKg.toLocaleString("es-CL")} kg`} />
                <Field label="Chip" value={<span className="font-mono text-xs">{patient.chip}</span>} />
                <Field
                  label="Propietario"
                  value={
                    <>
                      <Link href={`/pacientes/propietarios/${owner.rut}`} className="hover:text-primary hover:underline">
                        {ownerName(owner)}
                      </Link>
                      <span className="text-xs text-muted-foreground">RUT {formatRut(owner.rut)}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="size-3" /> {owner.phone}
                      </span>
                    </>
                  }
                />
                <Field
                  label="Clínica de origen"
                  value={
                    <span className="flex items-start gap-1">
                      <Building2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      {patient.clinic}
                    </span>
                  }
                />
              </dl>
            </div>
            <CareActionButtons patient={patient} />
          </CardContent>
        </Card>

        {(patient.allergies.length > 0 || patient.conditions.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {patient.allergies.length > 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-destructive">Alergias</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {patient.allergies.map((a) => (
                      <Badge key={a} variant="destructive">{a}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {patient.conditions.length > 0 && (
              <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
                <Stethoscope className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium">Condiciones crónicas</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {patient.conditions.map((c) => (
                      <Badge key={c} variant="secondary">{c}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <Tabs defaultValue="consultas">
          <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
            <TabsTrigger value="consultas">Consultas ({consultations.length})</TabsTrigger>
            <TabsTrigger value="vacunas">Vacunas ({patient.vaccines.length})</TabsTrigger>
            <TabsTrigger value="examenes">Exámenes ({patient.exams.length})</TabsTrigger>
            <TabsTrigger value="recetas">Recetas ({patient.prescriptions.length})</TabsTrigger>
            <TabsTrigger value="citas">Citas</TabsTrigger>
            <TabsTrigger value="facturas">Facturas</TabsTrigger>
            <TabsTrigger value="derivaciones">Derivaciones</TabsTrigger>
          </TabsList>

          <TabsContent value="consultas">
            <RequirePermission permission="ficha.ver" message="Tu rol no puede ver la información clínica (consultas, exámenes y recetas).">
            <Card>
              <CardHeader><CardTitle>Línea de tiempo de atenciones</CardTitle></CardHeader>
              <CardContent>
                <ol className="relative flex flex-col gap-6 border-l pl-6">
                  {consultations.map((c, i) => (
                    <li key={i} className="relative">
                      <span className="absolute top-1 -left-[29px] size-2.5 rounded-full bg-primary ring-4 ring-card" />
                      <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        <span className="font-medium tabular-nums">{formatDate(c.date)}</span>
                        <span className="text-muted-foreground">· {c.clinic} · {c.doctor}</span>
                      </div>
                      <p className="mt-1 font-medium">{c.reason}</p>
                      <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                        <div className="rounded-lg bg-muted/60 p-3">
                          <dt className="text-xs text-muted-foreground">Diagnóstico</dt>
                          <dd>{c.diagnosis}</dd>
                        </div>
                        <div className="rounded-lg bg-muted/60 p-3">
                          <dt className="text-xs text-muted-foreground">Tratamiento</dt>
                          <dd>{c.treatment}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
            </RequirePermission>
          </TabsContent>

          <TabsContent value="vacunas">
            <Card>
              <CardContent>
                {patient.vaccines.length === 0 ? <Empty text="Sin vacunas registradas." /> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vacuna</TableHead>
                        <TableHead>Aplicada</TableHead>
                        <TableHead>Próxima dosis</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patient.vaccines.map((v) => {
                        const days = v.nextDose ? daysUntil(v.nextDose) : null;
                        return (
                          <TableRow key={v.name}>
                            <TableCell className="font-medium">{v.name}</TableCell>
                            <TableCell className="tabular-nums">{formatDate(v.date)}</TableCell>
                            <TableCell className="tabular-nums">{v.nextDose ? formatDate(v.nextDose) : "—"}</TableCell>
                            <TableCell>
                              {days === null ? null : days < 0 ? (
                                <Badge variant="destructive"><AlertTriangle /> Vencida</Badge>
                              ) : days <= 30 ? (
                                <Badge variant="secondary"><Clock /> Próxima</Badge>
                              ) : (
                                <Badge variant="outline"><CheckCircle2 /> Vigente</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="examenes">
            <RequirePermission permission="ficha.ver" message="Tu rol no puede ver la información clínica (consultas, exámenes y recetas).">
            <Card>
              <CardContent>
                {patient.exams.length === 0 ? <Empty text="Sin exámenes registrados." /> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Examen</TableHead>
                        <TableHead>Resultado</TableHead>
                        <TableHead>Clínica</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patient.exams.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell className="tabular-nums">{formatDate(e.date)}</TableCell>
                          <TableCell className="font-medium">{e.name}</TableCell>
                          <TableCell className="whitespace-normal">{e.result}</TableCell>
                          <TableCell className="text-muted-foreground">{e.clinic}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            </RequirePermission>
          </TabsContent>

          <TabsContent value="recetas">
            <RequirePermission permission="ficha.ver" message="Tu rol no puede ver la información clínica (consultas, exámenes y recetas).">
            <Card>
              <CardContent>
                {patient.prescriptions.length === 0 ? <Empty text="Sin recetas registradas." /> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Medicamento</TableHead>
                        <TableHead>Dosis</TableHead>
                        <TableHead>Duración</TableHead>
                        <TableHead>Profesional</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patient.prescriptions.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="tabular-nums">{formatDate(r.date)}</TableCell>
                          <TableCell className="font-medium">{r.drug}</TableCell>
                          <TableCell>{r.dose}</TableCell>
                          <TableCell>{r.duration}</TableCell>
                          <TableCell className="text-muted-foreground">{r.doctor}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            </RequirePermission>
          </TabsContent>

          <TabsContent value="citas">
            <Card><CardContent><AppointmentsTable patientIds={[patient.id]} /></CardContent></Card>
          </TabsContent>
          <TabsContent value="facturas">
            <Card><CardContent><InvoicesTable patientIds={[patient.id]} /></CardContent></Card>
          </TabsContent>
          <TabsContent value="derivaciones">
            <Card><CardContent><ReferralsTable patientIds={[patient.id]} /></CardContent></Card>
          </TabsContent>
        </Tabs>
      </PageContainer>
    </AccessGate>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex flex-col">{value}</dd>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <EmptyState title={text} />;
}
