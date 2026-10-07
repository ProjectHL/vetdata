import { PageContainer } from "@/components/layout/page-container";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Cake,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { OwnerGate } from "@/components/owners/owner-gate";
import { OwnerPets } from "@/components/owners/owner-pets";
import { OwnerRecords } from "@/components/owners/owner-records";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOwner, ownerLastVisit, petsOf } from "@/lib/lookups";
import { ownerName } from "@/domain/owners";
import { ageFrom, formatCLP, formatDate, formatRut } from "@/lib/format";

export default async function PropietarioPage(props: PageProps<"/pacientes/propietarios/[rut]">) {
  const { rut } = await props.params;
  const owner = getOwner(decodeURIComponent(rut).toUpperCase());
  if (!owner) notFound();

  const pets = petsOf(owner.rut);
  const petIds = pets.map((p) => p.id);
  const initials = `${owner.firstName[0]}${owner.lastName[0]}`;

  return (
    <OwnerGate ownerRut={owner.rut}>
      <PageContainer>
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/pacientes/propietarios"><ArrowLeft /> Volver a propietarios</Link>
        </Button>

        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          {/* Datos del propietario */}
          <Card className="h-fit">
            <CardContent className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                  {initials}
                </span>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">{ownerName(owner)}</h1>
                  <p className="text-sm text-muted-foreground tabular-nums">RUT {formatRut(owner.rut)}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {owner.shareConsent ? (
                  <Badge variant="outline" className="text-primary"><ShieldCheck /> Comparte datos en la red</Badge>
                ) : (
                  <Badge variant="secondary"><ShieldAlert /> Sin consentimiento para compartir</Badge>
                )}
                {owner.balance > 0 && <Badge variant="destructive">Saldo {formatCLP(owner.balance)}</Badge>}
              </div>

              <dl className="flex flex-col gap-3 text-sm">
                <Info icon={Phone} label="Teléfono">
                  {owner.phone}
                  {owner.altPhone && <span className="block text-muted-foreground">{owner.altPhone}</span>}
                </Info>
                <Info icon={Mail} label="Email">{owner.email}</Info>
                <Info icon={MessageCircle} label="Contacto preferido">{owner.preferredContact}</Info>
                <Info icon={MapPin} label="Dirección">
                  {owner.address}
                  <span className="block text-muted-foreground">{owner.sector}, {owner.region}</span>
                </Info>
                <Info icon={Cake} label="Fecha de nacimiento">
                  {formatDate(owner.birthDate)} ({ageFrom(owner.birthDate)})
                </Info>
                <Info icon={UserRound} label="Contacto de emergencia">
                  {owner.emergencyContact.name}
                  <span className="block text-muted-foreground">{owner.emergencyContact.phone}</span>
                </Info>
              </dl>

              <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/60 p-3 text-center text-xs">
                <div>
                  <p className="text-lg font-semibold tabular-nums">{pets.length}</p>
                  <p className="text-muted-foreground">Mascotas</p>
                </div>
                <div>
                  <p className="font-semibold tabular-nums">{formatDate(ownerLastVisit(owner.rut))}</p>
                  <p className="text-muted-foreground">Última visita</p>
                </div>
                <div>
                  <p className="font-semibold tabular-nums">{formatDate(owner.registeredAt)}</p>
                  <p className="text-muted-foreground">Cliente desde</p>
                </div>
              </div>

              {owner.notes && (
                <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{owner.notes}</p>
              )}
            </CardContent>
          </Card>

          <div className="flex min-w-0 flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Mascotas vinculadas ({pets.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <OwnerPets patientIds={petIds} />
              </CardContent>
            </Card>

            <OwnerRecords ownerRut={owner.rut} />
          </div>
        </div>
      </PageContainer>
    </OwnerGate>
  );
}

function Info({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}
