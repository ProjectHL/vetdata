"use client";

import { ownerName } from "@/domain/owners";
import { type Sale, ivaIncluded } from "@/domain/retail";
import { formatCLP, formatDate, formatRut } from "@/lib/format";
import { useRetail } from "@/lib/retail-store";
import { read } from "@/lib/server-state";
import { owners as mockOwners } from "@/mocks/owners";
import { useStore } from "@/lib/store";

/** Boleta electrónica (vista previa). */
export function Receipt({ sale }: { sale: Sale }) {
  const { clinicProfile } = useStore();
  const { products } = useRetail();
  const owners = read("owners", mockOwners);
  const owner = sale.ownerRut ? owners.find((o) => o.rut === sale.ownerRut) : undefined;
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-sm">
      <div className="flex justify-between gap-4">
        <div>
          <p className="font-semibold">{clinicProfile.legalName}</p>
          <p className="text-xs text-muted-foreground">RUT {clinicProfile.rut} · {clinicProfile.address}</p>
        </div>
        <div className="rounded-md border-2 border-primary px-3 py-1 text-center text-xs font-semibold text-primary">
          BOLETA
          <br />N° {sale.number}
        </div>
      </div>
      <div className="grid gap-1 text-xs sm:grid-cols-2">
        <p><span className="text-muted-foreground">Fecha:</span> {formatDate(sale.date)} {sale.time}</p>
        <p><span className="text-muted-foreground">Pago:</span> {sale.payment}</p>
        {owner && <p><span className="text-muted-foreground">Cliente:</span> {ownerName(owner)} ({formatRut(owner.rut)})</p>}
        <p><span className="text-muted-foreground">Atendió:</span> {sale.seller}</p>
      </div>
      <ul className="divide-y text-xs">
        {sale.items.map((i) => (
          <li key={i.productId} className="flex justify-between gap-2 py-1.5">
            <span>{i.qty} × {products.find((p) => p.id === i.productId)?.name}</span>
            <span className="tabular-nums">{formatCLP(i.qty * i.unitPrice)}</span>
          </li>
        ))}
        {sale.deliveryFee > 0 && (
          <li className="flex justify-between gap-2 py-1.5">
            <span>Despacho a domicilio</span>
            <span className="tabular-nums">{formatCLP(sale.deliveryFee)}</span>
          </li>
        )}
      </ul>
      <dl className="ml-auto grid w-full max-w-56 grid-cols-2 gap-1 tabular-nums">
        <dt className="text-muted-foreground">IVA incluido</dt>
        <dd className="text-right">{formatCLP(ivaIncluded(sale.total))}</dd>
        <dt className="font-semibold">Total</dt>
        <dd className="text-right font-semibold">{formatCLP(sale.total)}</dd>
      </dl>
    </div>
  );
}
