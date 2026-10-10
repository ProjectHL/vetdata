"use client";

import { useState } from "react";
import { Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import type { Invoice, InvoiceItem } from "@/domain/invoices";
import { ownerName } from "@/domain/owners";
import type { Patient } from "@/domain/patients";
import { IVA_RATE } from "@/domain/services";
import { TODAY, formatCLP, formatDate, formatRut } from "@/lib/format";
import { useStore } from "@/lib/store";
import { read } from "@/lib/server-state";
import { owners as mockOwners } from "@/mocks/owners";
import { services } from "@/mocks/services";
import { SuccessPanel } from "./field";

type Row = InvoiceItem & { key: number };

let rowKey = 0;

function totals(items: InvoiceItem[]) {
  const net = items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
  const iva = Math.round(net * IVA_RATE);
  return { net, iva, total: net + iva };
}

export function InvoiceForm({ patient, onDone }: { patient: Patient; onDone: () => void }) {
  const { addInvoice, medications } = useStore();
  const owners = read("owners", mockOwners);
  const owner = owners.find((o) => o.rut === patient.ownerRut)!;
  const [rows, setRows] = useState<Row[]>([
    { key: ++rowKey, description: services[0].name, qty: 1, unitPrice: services[0].price },
  ]);
  const [picker, setPicker] = useState("");
  const [created, setCreated] = useState<Invoice | null>(null);

  const addItem = (value: string) => {
    const [kind, id] = value.split(":");
    const source =
      kind === "s"
        ? services.find((s) => s.id === id)
        : medications.find((m) => m.id === id);
    if (!source) return;
    setRows((prev) => [
      ...prev,
      { key: ++rowKey, description: source.name, qty: 1, unitPrice: source.price, medicationId: kind === "m" ? id : undefined },
    ]);
    setPicker("");
  };

  const { net, iva, total } = totals(rows);

  if (created) {
    return (
      <SuccessPanel
        title={`Factura N° ${created.folio} emitida`}
        onDone={onDone}
        extra={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Imprimir
          </Button>
        }
      >
        <InvoicePreview invoice={created} patient={patient} />
      </SuccessPanel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 rounded-lg bg-muted/60 p-3 text-sm sm:grid-cols-2">
        <div>
          <span className="text-xs text-muted-foreground">Cliente</span>
          <p className="font-medium">{ownerName(owner)}</p>
          <p className="text-xs text-muted-foreground">RUT {formatRut(owner.rut)}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Paciente · Fecha</span>
          <p className="font-medium">{patient.name}</p>
          <p className="text-xs text-muted-foreground">{formatDate(TODAY)}</p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Detalle</TableHead>
            <TableHead className="w-20">Cant.</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Subtotal</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="whitespace-normal">{row.description}</TableCell>
              <TableCell>
                <Input aria-label={`Cantidad de ${row.description}`}
                  type="number"
                  min={1}
                  value={row.qty}
                  onChange={(e) => {
                    const qty = Math.max(1, Number(e.target.value) || 1);
                    setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, qty } : r)));
                  }}
                  className="h-8 w-16"
                />
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCLP(row.unitPrice)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCLP(row.qty * row.unitPrice)}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Quitar ítem"
                  onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                >
                  <Trash2 />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Select value={picker} onValueChange={addItem}>
        <SelectTrigger aria-label="Agregar ítem" className="w-full">
          <Plus className="size-4" />
          <SelectValue placeholder="Agregar prestación o medicamento" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Prestaciones</SelectLabel>
            {services.map((s) => (
              <SelectItem key={s.id} value={`s:${s.id}`}>{s.name} · {formatCLP(s.price)}</SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Medicamentos</SelectLabel>
            {medications.filter((m) => m.stock > 0).map((m) => (
              <SelectItem key={m.id} value={`m:${m.id}`}>{m.name} · {formatCLP(m.price)}</SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Totals net={net} iva={iva} total={total} />

      <div className="flex justify-end">
        <Button
          disabled={rows.length === 0}
          onClick={() =>
            setCreated(
              addInvoice({
                patientId: patient.id,
                ownerRut: owner.rut,
                date: TODAY,
                items: rows.map(({ description, qty, unitPrice, medicationId }) => ({ description, qty, unitPrice, medicationId })),
                net,
                iva,
                total,
                status: "Emitida",
              })
            )
          }
        >
          Emitir factura · {formatCLP(total)}
        </Button>
      </div>
    </div>
  );
}

function Totals({ net, iva, total }: { net: number; iva: number; total: number }) {
  return (
    <dl className="ml-auto grid w-full max-w-60 grid-cols-2 gap-1 text-sm tabular-nums">
      <dt className="text-muted-foreground">Neto</dt>
      <dd className="text-right">{formatCLP(net)}</dd>
      <dt className="text-muted-foreground">IVA 19%</dt>
      <dd className="text-right">{formatCLP(iva)}</dd>
      <dt className="font-semibold">Total</dt>
      <dd className="text-right font-semibold">{formatCLP(total)}</dd>
    </dl>
  );
}

export function InvoicePreview({ invoice, patient }: { invoice: Invoice; patient: Patient }) {
  const owners = read("owners", mockOwners);
  const owner = owners.find((o) => o.rut === invoice.ownerRut)!;
  const { clinicProfile } = useStore();
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex justify-between gap-4">
        <div>
          <p className="font-semibold">{clinicProfile.legalName}</p>
          <p className="text-xs text-muted-foreground">
            RUT {clinicProfile.rut} · {clinicProfile.address}, {clinicProfile.sector}
          </p>
        </div>
        <div className="rounded-md border-2 border-primary px-3 py-1 text-center text-xs font-semibold text-primary">
          FACTURA
          <br />N° {invoice.folio}
        </div>
      </div>
      <div className="grid gap-1 text-xs sm:grid-cols-2">
        <p><span className="text-muted-foreground">Cliente:</span> {ownerName(owner)}</p>
        <p><span className="text-muted-foreground">RUT:</span> {formatRut(owner.rut)}</p>
        <p><span className="text-muted-foreground">Paciente:</span> {patient.name} ({patient.species})</p>
        <p><span className="text-muted-foreground">Fecha:</span> {formatDate(invoice.date)}</p>
      </div>
      <ul className="divide-y text-xs">
        {invoice.items.map((i, idx) => (
          <li key={idx} className="flex justify-between gap-2 py-1.5">
            <span>{i.qty} × {i.description}</span>
            <span className="tabular-nums">{formatCLP(i.qty * i.unitPrice)}</span>
          </li>
        ))}
      </ul>
      <Totals net={invoice.net} iva={invoice.iva} total={invoice.total} />
    </div>
  );
}
