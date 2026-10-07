"use client";

import { useState } from "react";
import { AlertTriangle, Boxes, PackageSearch, Percent, Search, Wallet } from "lucide-react";
import { StatTile } from "@/components/analytics/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { retailSuppliers } from "@/lib/lookups";
import { CATEGORIES, LOCATIONS, type Product, margin, stockLevel, totalStock } from "@/domain/retail";
import { formatCLP, formatDate } from "@/lib/format";
import { useRetail } from "@/lib/retail-store";
import { cn } from "@/lib/utils";
import { ProductThumb, StockLevelBadge } from "./shared";
import { EmptyState } from "@/components/layout/empty-state";
import { clickableRow } from "@/components/layout/clickable-row";

const SPECIES = ["Perro", "Gato", "Ave", "Conejo", "Todas"];

export function Catalog() {
  const { products, sales } = useRetail();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [species, setSpecies] = useState("all");
  const [selected, setSelected] = useState<Product | null>(null);

  const q = query.trim().toLowerCase();
  const rows = products.filter(
    (p) =>
      (category === "all" || p.category === category) &&
      (species === "all" || p.species === species || p.species === "Todas") &&
      (!q || [p.name, p.brand, p.sku].some((v) => v.toLowerCase().includes(q)))
  );
  const stockValue = products.reduce((s, p) => s + totalStock(p) * p.cost, 0);
  const avgMargin = Math.round(products.reduce((s, p) => s + margin(p), 0) / products.length);
  const alerts = products.filter((p) => stockLevel(p) !== "OK").length;
  const sold = (id: string) => sales.flatMap((s) => s.items).filter((i) => i.productId === id).reduce((s, i) => s + i.qty, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Boxes} label="Productos (SKU)" value={products.length} hint={`${CATEGORIES.length} categorías`} />
        <StatTile icon={Wallet} label="Inventario valorizado (costo)" value={formatCLP(stockValue)} />
        <StatTile icon={Percent} label="Margen promedio" value={`${avgMargin}%`} hint="Sobre precio neto" />
        <StatTile icon={AlertTriangle} tone="text-destructive" label="Con alerta de stock" value={alerts} hint="Reponer sala o comprar" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_200px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Buscar productos" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre, marca o SKU" className="pl-8" />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger aria-label="Filtrar por categoría" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={species} onValueChange={setSpecies}>
              <SelectTrigger aria-label="Filtrar por especie" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las especies</SelectItem>
                {SPECIES.filter((s) => s !== "Todas").map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Especie</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Margen</TableHead>
                <TableHead className="text-right">Sala</TableHead>
                <TableHead className="text-right">Bodega</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id} {...clickableRow(() => setSelected(p))}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <ProductThumb category={p.category} className="size-9" />
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.brand} · <span className="font-mono">{p.sku}</span></p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{p.category}</TableCell>
                  <TableCell>{p.species}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCLP(p.price)}</TableCell>
                  <TableCell className="text-right tabular-nums">{margin(p)}%</TableCell>
                  <TableCell className={cn("text-right tabular-nums", p.stock.sala < p.shelfMin && "font-medium text-destructive")}>{p.stock.sala}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.stock.central}</TableCell>
                  <TableCell><StockLevelBadge level={stockLevel(p)} /></TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="whitespace-normal">
                    <EmptyState icon={PackageSearch} title="Sin productos para estos filtros." />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          {selected && (() => {
            const p = products.find((x) => x.id === selected.id)!;
            const supplier = retailSuppliers.find((s) => s.id === p.supplierId);
            const lastSales = sales.filter((s) => s.items.some((i) => i.productId === p.id)).slice(-3).reverse();
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <ProductThumb category={p.category} className="size-12" />
                    <div className="text-left">
                      <DialogTitle>{p.name}</DialogTitle>
                      <DialogDescription>{p.brand} · SKU {p.sku} · {p.category} · {p.species}</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <Info label="Precio venta (IVA incl.)" value={formatCLP(p.price)} />
                  <Info label="Costo neto" value={formatCLP(p.cost)} />
                  <Info label="Margen" value={`${margin(p)}%`} />
                  <Info label={LOCATIONS.sala} value={`${p.stock.sala} u. (mín. ${p.shelfMin})`} />
                  <Info label={`${LOCATIONS.central} · ${p.bin}`} value={`${p.stock.central} u.`} />
                  <Info label="Punto de compra" value={`${p.reorderPoint} u.`} />
                  <Info label="Proveedor" value={supplier?.name ?? "—"} className="col-span-2" />
                  <Info label="Vendidas (14 días)" value={`${sold(p.id)} u.`} />
                </dl>
                <div className="flex items-center gap-2"><StockLevelBadge level={stockLevel(p)} /></div>
                {lastSales.length > 0 && (
                  <div className="text-sm">
                    <p className="mb-1 text-xs text-muted-foreground">Últimas ventas</p>
                    {lastSales.map((s) => (
                      <p key={s.id} className="flex justify-between">
                        <span>Boleta {s.number} · {formatDate(s.date)}</span>
                        <Badge variant="outline">{s.channel}</Badge>
                      </p>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg bg-muted/60 p-2.5", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
