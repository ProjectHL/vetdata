"use client";

import { AppointmentsTable, InvoicesTable, ReferralsTable } from "@/components/care-actions/records";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { accessLevel } from "@/domain/sharing";
import { formatCLP, formatDate } from "@/lib/format";
import { useCurrentClinic, usePatients } from "@/lib/server-state";
import { useRetail } from "@/lib/retail-store";
import { useCanView, useStore } from "@/lib/store";
import { EmptyState } from "@/components/layout/empty-state";

/** Citas, facturas, derivaciones y visitas del dueño, solo de las mascotas accesibles. */
export function OwnerRecords({ ownerRut }: { ownerRut: string }) {
  const canView = useCanView();
  const patients = usePatients();
  const pets = patients.filter((p) => p.ownerRut === ownerRut).filter((p) => canView(p.id));
  const petIds = pets.map((p) => p.id);

  return (
    <Tabs defaultValue="citas">
      <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
        <TabsTrigger value="citas">Citas</TabsTrigger>
        <TabsTrigger value="facturas">Facturas</TabsTrigger>
        <TabsTrigger value="derivaciones">Derivaciones</TabsTrigger>
        <TabsTrigger value="visitas">Historial de visitas</TabsTrigger>
        <TabsTrigger value="tienda">Compras en tienda</TabsTrigger>
      </TabsList>
      <TabsContent value="citas">
        <Card><CardContent><AppointmentsTable patientIds={petIds} showPatient /></CardContent></Card>
      </TabsContent>
      <TabsContent value="facturas">
        <Card><CardContent><InvoicesTable patientIds={petIds} showPatient /></CardContent></Card>
      </TabsContent>
      <TabsContent value="derivaciones">
        <Card><CardContent><ReferralsTable patientIds={petIds} showPatient /></CardContent></Card>
      </TabsContent>
      <TabsContent value="visitas">
        <Card>
          <CardContent>
            <VisitsTable petIds={petIds} ownerRut={ownerRut} />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="tienda">
        <Card>
          <CardContent>
            <StorePurchases ownerRut={ownerRut} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function StorePurchases({ ownerRut }: { ownerRut: string }) {
  const { sales, products } = useRetail();
  const mine = sales.filter((s) => s.ownerRut === ownerRut).sort((a, b) => b.date.localeCompare(a.date));
  if (mine.length === 0) return <EmptyState title="Sin compras en la tienda." />;
  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        {mine.length} compras · total {formatCLP(mine.reduce((s, x) => s + x.total, 0))}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Boleta</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Productos</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mine.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium tabular-nums">{s.number}</TableCell>
              <TableCell className="tabular-nums">{formatDate(s.date)}</TableCell>
              <TableCell className="whitespace-normal text-sm">
                {s.items.map((i) => `${i.qty} × ${products.find((p) => p.id === i.productId)?.name}`).join(", ")}
              </TableCell>
              <TableCell>{s.channel === "Web" ? "Web (despacho)" : "Mesón"}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCLP(s.total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

/** Visitas de todas las mascotas accesibles; con acceso "Resumen clínico" no se incluyen consultas. */
function VisitsTable({ petIds, ownerRut }: { petIds: string[]; ownerRut: string }) {
  const { grants } = useStore();
  const patients = usePatients();
  const currentClinic = useCurrentClinic();
  const pets = patients.filter((p) => p.ownerRut === ownerRut).filter((p) => petIds.includes(p.id));
  const summaryOnly = pets.filter((p) => accessLevel(p, grants, currentClinic).grant?.scope === "Resumen clínico");
  const visits = pets
    .filter((p) => !summaryOnly.includes(p))
    .flatMap((p) => p.consultations.map((c) => ({ ...c, pet: p.name })))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Mascota</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Diagnóstico</TableHead>
            <TableHead>Clínica · Profesional</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visits.map((v, i) => (
            <TableRow key={i}>
              <TableCell className="tabular-nums">{formatDate(v.date)}</TableCell>
              <TableCell className="font-medium">{v.pet}</TableCell>
              <TableCell>{v.reason}</TableCell>
              <TableCell className="whitespace-normal">{v.diagnosis}</TableCell>
              <TableCell className="text-muted-foreground">{v.clinic} · {v.doctor}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {summaryOnly.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {summaryOnly.map((p) => p.name).join(", ")}: consultas no incluidas (acceso de resumen clínico).
        </p>
      )}
    </>
  );
}
