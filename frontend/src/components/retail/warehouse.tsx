"use client";

import { useState } from "react";
import { ArrowRightLeft, PackageOpen, Store, Warehouse } from "lucide-react";
import { Field } from "@/components/care-actions/field";
import { Guard } from "@/components/settings/guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { LOCATIONS, type Location, type Product, type RetailMovementType, stockLevel } from "@/domain/retail";
import { formatCLP, formatDate } from "@/lib/format";
import { useRetail } from "@/lib/retail-store";
import { cn } from "@/lib/utils";
import { ProductThumb, StockLevelBadge } from "./shared";

/** Unidades a llevar a sala: hasta el doble del mínimo exhibido, sin superar lo que hay en bodega. */
function refillQty(p: Product) {
  return Math.min(p.stock.central, Math.max(0, p.shelfMin * 2 - p.stock.sala));
}

export function WarehouseView() {
  const { products, movements, transferToSala } = useRetail();
  const [transfer, setTransfer] = useState<Product | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [type, setType] = useState<"all" | RetailMovementType>("all");

  const refill = products.filter((p) => p.stock.sala < p.shelfMin && refillQty(p) > 0);
  const summary = (loc: Location) => ({
    units: products.reduce((s, p) => s + p.stock[loc], 0),
    value: products.reduce((s, p) => s + p.stock[loc] * p.cost, 0),
  });
  const central = summary("central");
  const sala = summary("sala");
  const productOf = (id: string) => products.find((p) => p.id === id);
  const log = [...movements]
    .filter((m) => type === "all" || m.type === type)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <LocationCard icon={Warehouse} title={LOCATIONS.central} units={central.units} value={central.value} note="Recibe las compras y abastece la sala." />
        <LocationCard icon={Store} title={LOCATIONS.sala} units={sala.units} value={sala.value} note={`${products.filter((p) => p.stock.sala < p.shelfMin).length} productos bajo el mínimo exhibido.`} />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Reponer sala de ventas</CardTitle>
            <CardDescription>Productos bajo el mínimo en sala con stock disponible en bodega central.</CardDescription>
          </div>
          {refill.length > 0 && (
            <Guard permission="tienda.inventario">
              <Button onClick={() => refill.forEach((p) => transferToSala(p.id, refillQty(p)))}>
                <ArrowRightLeft /> Reponer todo ({refill.length})
              </Button>
            </Guard>
          )}
        </CardHeader>
        <CardContent>
          {refill.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">La sala está abastecida.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {refill.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                  <ProductThumb category={p.category} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Sala {p.stock.sala}/{p.shelfMin} · bodega {p.stock.central} · {p.bin}
                    </p>
                  </div>
                  <Guard permission="tienda.inventario">
                    <Button size="sm" variant="outline" onClick={() => transferToSala(p.id, refillQty(p))}>
                      Llevar {refillQty(p)}
                    </Button>
                  </Guard>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock por ubicación</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Ubicación bodega</TableHead>
                <TableHead className="text-right">Bodega</TableHead>
                <TableHead className="text-right">Sala</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <p className="font-medium">{p.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.bin}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.stock.central}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", p.stock.sala < p.shelfMin && "font-medium text-destructive")}>{p.stock.sala}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{p.stock.central + p.stock.sala}</TableCell>
                  <TableCell><StockLevelBadge level={stockLevel(p)} /></TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex gap-1">
                      <Guard permission="tienda.inventario">
                        <Button size="sm" variant="ghost" disabled={p.stock.central === 0} onClick={() => setTransfer(p)}>Transferir</Button>
                      </Guard>
                      <Guard permission="tienda.inventario">
                        <Button size="sm" variant="ghost" onClick={() => setAdjusting(p)}>Ajustar</Button>
                      </Guard>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Movimientos de bodega</CardTitle>
            <CardDescription>Compras, ventas, reposiciones de sala, mermas y conteos.</CardDescription>
          </div>
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger aria-label="Tipo de movimiento" size="sm" className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(["Entrada", "Salida", "Transferencia", "Ajuste"] as const).map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Usuario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="tabular-nums">{formatDate(m.date)}</TableCell>
                  <TableCell className="font-medium">{productOf(m.productId)?.name}</TableCell>
                  <TableCell>
                    <Badge variant={m.type === "Ajuste" ? "destructive" : m.type === "Entrada" ? "default" : "secondary"}>{m.type}</Badge>
                    <span className="ml-1 text-xs text-muted-foreground">{m.reason}</span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {m.from ? `${LOCATIONS[m.from]} → ${LOCATIONS[m.location]}` : LOCATIONS[m.location]}
                  </TableCell>
                  <TableCell className={cn("text-right font-medium tabular-nums", m.qty > 0 && m.type !== "Transferencia" && "text-primary")}>
                    {m.type === "Transferencia" ? m.qty : m.qty > 0 ? `+${m.qty}` : m.qty}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.ref ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{m.user}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TransferDialog product={transfer && products.find((p) => p.id === transfer.id)!} onClose={() => setTransfer(null)} />
      <AdjustDialog product={adjusting && products.find((p) => p.id === adjusting.id)!} onClose={() => setAdjusting(null)} />
    </div>
  );
}

function LocationCard({
  icon: Icon,
  title,
  units,
  value,
  note,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  units: number;
  value: number;
  note: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-6" />
        </span>
        <div className="flex-1">
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{note}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums">{units}</p>
          <p className="text-xs text-muted-foreground tabular-nums">u. · {formatCLP(value)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TransferDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { transferToSala } = useRetail();
  const [qty, setQty] = useState(1);
  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {product && (
          <>
            <DialogHeader>
              <DialogTitle>Transferir a sala</DialogTitle>
              <DialogDescription>{product.name} · bodega {product.stock.central} u. · sala {product.stock.sala} u.</DialogDescription>
            </DialogHeader>
            <Field label="Unidades" htmlFor="tr-qty">
              <Input id="tr-qty" type="number" min={1} max={product.stock.central} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(product.stock.central, Number(e.target.value) || 1)))} />
            </Field>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={() => { transferToSala(product.id, qty); setQty(1); onClose(); }}>
                <PackageOpen /> Transferir
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { adjust } = useRetail();
  const [location, setLocation] = useState<Location>("sala");
  const [reason, setReason] = useState<"Merma" | "Conteo">("Conteo");
  const [counted, setCounted] = useState<number | "">("");
  if (!product) return <Dialog open={false} />;
  const current = product.stock[location];
  const delta = counted === "" ? 0 : reason === "Conteo" ? counted - current : -counted;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ajustar inventario</DialogTitle>
          <DialogDescription>{product.name}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ubicación">
            <Select value={location} onValueChange={(v) => setLocation(v as Location)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sala">{LOCATIONS.sala}</SelectItem>
                <SelectItem value="central">{LOCATIONS.central}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Motivo">
            <Select value={reason} onValueChange={(v) => setReason(v as typeof reason)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Conteo">Conteo físico</SelectItem>
                <SelectItem value="Merma">Merma / dañado</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={reason === "Conteo" ? `Contado (sistema: ${current})` : "Unidades dañadas"} htmlFor="adj-n" className="col-span-2">
            <Input id="adj-n" type="number" min={0} value={counted} onChange={(e) => setCounted(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))} />
          </Field>
        </div>
        {counted !== "" && <p className="text-sm text-muted-foreground">Diferencia a registrar: <strong className="text-foreground tabular-nums">{delta > 0 ? `+${delta}` : delta}</strong></p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={counted === "" || delta === 0}
            onClick={() => {
              adjust(product.id, location, delta, reason);
              setCounted("");
              onClose();
            }}
          >
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
