"use client";

import { useState } from "react";
import Link from "next/link";
import { Minus, PawPrint, Plus, Printer, Search, ShoppingCart, Sparkles, Trash2, Truck, UserRound, X } from "lucide-react";
import { Field } from "@/components/care-actions/field";
import { SpeciesIcon } from "@/components/patients/species-icon";
import { Guard } from "@/components/settings/guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Owner, ownerName } from "@/domain/owners";
import { CATEGORIES, COURIERS, PAYMENT_METHODS, type PaymentMethod, type Product, type Sale, deliveryFee, ivaIncluded } from "@/domain/retail";
import { formatCLP, formatRut, normalizeRut } from "@/lib/format";
import { useRetail } from "@/lib/retail-store";
import { useOwners, usePatients } from "@/lib/server-state";
import { cn } from "@/lib/utils";
import { Receipt } from "./receipt";
import { ProductThumb } from "./shared";

type Line = { productId: string; qty: number };

export function PointOfSale() {
  const { products, checkout } = useRetail();
  const owners = useOwners();
  const patients = usePatients();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [cart, setCart] = useState<Line[]>([]);
  const [rutInput, setRutInput] = useState("");
  const [customer, setCustomer] = useState<Owner | null>(null);
  const [rutError, setRutError] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("Débito");
  const [delivery, setDelivery] = useState(false);
  const [courier, setCourier] = useState(COURIERS[0]);
  const [sale, setSale] = useState<Sale | null>(null);

  const productOf = (id: string) => products.find((p) => p.id === id)!;
  const q = query.trim().toLowerCase();
  const list = products.filter(
    (p) => (category === "all" || p.category === category) && (!q || [p.name, p.brand, p.sku].some((v) => v.toLowerCase().includes(q)))
  );

  const inCart = (id: string) => cart.find((l) => l.productId === id)?.qty ?? 0;
  const add = (p: Product) => {
    if (inCart(p.id) >= p.stock.sala) return;
    setCart((prev) =>
      prev.some((l) => l.productId === p.id)
        ? prev.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l))
        : [...prev, { productId: p.id, qty: 1 }]
    );
  };
  const setQty = (id: string, qty: number) =>
    setCart((prev) =>
      qty <= 0 ? prev.filter((l) => l.productId !== id) : prev.map((l) => (l.productId === id ? { ...l, qty: Math.min(qty, productOf(id).stock.sala) } : l))
    );

  const subtotal = cart.reduce((s, l) => s + l.qty * productOf(l.productId).price, 0);
  const fee = delivery && customer ? deliveryFee(customer.sector) : 0;
  const total = subtotal + fee;

  // Sugerencias según las especies de las mascotas del cliente.
  const pets = customer ? patients.filter((p) => p.ownerRut === customer.rut) : [];
  const petSpecies: string[] = [...new Set(pets.map((p) => p.species))];
  const suggestions = customer
    ? products
        .filter((p) => petSpecies.includes(p.species) && p.stock.sala > 0 && !inCart(p.id))
        .slice(0, 4)
    : [];

  const findCustomer = () => {
    const r = normalizeRut(rutInput.trim());
    const owner = owners.find((o) => o.rut === r || o.rut.split("-")[0] === r);
    setCustomer(owner ?? null);
    setRutError(owner ? "" : "No hay un cliente con ese RUT. La venta puede hacerse sin cliente.");
    if (!owner) setDelivery(false);
  };

  const reset = () => {
    setCart([]);
    setCustomer(null);
    setRutInput("");
    setDelivery(false);
    setPayment("Débito");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Productos */}
      <div className="flex min-w-0 flex-col gap-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar productos" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto, marca o escanear SKU" className="pl-8" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["all", ...CATEGORIES].map((c) => (
            <Button key={c} size="sm" variant={category === c ? "default" : "outline"} onClick={() => setCategory(c)}>
              {c === "all" ? "Todo" : c}
            </Button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const available = p.stock.sala - inCart(p.id);
            return (
              <button
                key={p.id}
                type="button"
                disabled={available <= 0}
                onClick={() => add(p)}
                className="flex flex-col gap-2 rounded-xl border bg-card p-3 text-left transition hover:border-primary/50 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-start gap-2">
                  <ProductThumb category={p.category} className="size-9" />
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm leading-tight font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.brand}</p>
                  </div>
                </div>
                <div className="mt-auto flex items-end justify-between">
                  <span className="font-semibold tabular-nums">{formatCLP(p.price)}</span>
                  <span className={cn("text-xs tabular-nums", available <= 2 ? "text-destructive" : "text-muted-foreground")}>
                    {available > 0 ? `${available} en sala` : p.stock.central > 0 ? "Solo en bodega" : "Agotado"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Carro */}
      <Card className="h-fit lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="size-4" /> Venta actual
            {cart.length > 0 && <Badge variant="secondary">{cart.reduce((s, l) => s + l.qty, 0)} u.</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Cliente */}
          {customer ? (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/60 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link href={`/pacientes/propietarios/${customer.rut}`} className="font-medium hover:text-primary hover:underline">
                    {ownerName(customer)}
                  </Link>
                  <p className="text-xs text-muted-foreground tabular-nums">{formatRut(customer.rut)} · {customer.sector}</p>
                </div>
                <Button size="icon" variant="ghost" className="size-7" aria-label="Quitar cliente" onClick={() => { setCustomer(null); setDelivery(false); }}>
                  <X />
                </Button>
              </div>
              {pets.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {pets.map((p) => (
                    <Badge key={p.id} variant="outline"><SpeciesIcon species={p.species} /> {p.name}</Badge>
                  ))}
                </div>
              )}
              {suggestions.length > 0 && (
                <div>
                  <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><Sparkles className="size-3" /> Sugeridos para sus mascotas</p>
                  <div className="flex flex-wrap gap-1">
                    {suggestions.map((p) => (
                      <Button key={p.id} size="sm" variant="outline" className="h-7 text-xs" onClick={() => add(p)}>
                        <Plus /> {p.name.length > 26 ? `${p.name.slice(0, 26)}…` : p.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form
              className="flex flex-col gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                findCustomer();
              }}
            >
              <Label className="text-xs text-muted-foreground">Cliente (opcional)</Label>
              <div className="flex gap-2">
                <Input aria-label="RUT del dueño" value={rutInput} onChange={(e) => setRutInput(e.target.value)} placeholder="RUT del dueño" />
                <Button type="submit" variant="outline"><UserRound /> Buscar</Button>
              </div>
              {rutError && <p className="text-xs text-muted-foreground">{rutError}</p>}
            </form>
          )}

          {/* Líneas */}
          {cart.length === 0 ? (
            <p className="flex flex-col items-center gap-1 py-6 text-center text-sm text-muted-foreground">
              <PawPrint className="size-5" /> Agrega productos desde el catálogo.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {cart.map((l) => {
                const p = productOf(l.productId);
                return (
                  <li key={l.productId} className="flex items-center gap-2 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{formatCLP(p.price)} c/u</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="size-7" aria-label="Restar" onClick={() => setQty(l.productId, l.qty - 1)}><Minus /></Button>
                      <span className="w-6 text-center tabular-nums">{l.qty}</span>
                      <Button size="icon" variant="outline" className="size-7" aria-label="Sumar" disabled={l.qty >= p.stock.sala} onClick={() => setQty(l.productId, l.qty + 1)}><Plus /></Button>
                    </div>
                    <span className="w-20 text-right font-medium tabular-nums">{formatCLP(l.qty * p.price)}</span>
                    <Button size="icon" variant="ghost" className="size-7" aria-label="Quitar" onClick={() => setQty(l.productId, 0)}><Trash2 /></Button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Pago y despacho */}
          <Field label="Medio de pago">
            <Select value={payment} onValueChange={(v) => setPayment(v as PaymentMethod)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Checkbox id="pos-delivery" checked={delivery} disabled={!customer} onCheckedChange={(v) => setDelivery(v === true)} />
              <Label htmlFor="pos-delivery" className={cn("font-normal", !customer && "text-muted-foreground")}>
                <Truck className="size-4" /> Despacho a domicilio {!customer && "(requiere cliente)"}
              </Label>
            </div>
            {delivery && customer && (
              <div className="flex flex-col gap-2 rounded-lg border p-3 text-xs">
                <p>{customer.address}, {customer.sector}</p>
                <Select value={courier} onValueChange={setCourier}>
                  <SelectTrigger aria-label="Empresa de despacho" size="sm" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COURIERS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground">
                  {fee === 0 ? "Despacho gratis en Providencia" : `Tarifa ${formatCLP(fee)} · entrega mañana`}
                </p>
              </div>
            )}
          </div>

          {/* Totales */}
          <dl className="grid grid-cols-2 gap-1 border-t pt-3 text-sm tabular-nums">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="text-right">{formatCLP(subtotal)}</dd>
            {delivery && (
              <>
                <dt className="text-muted-foreground">Despacho</dt>
                <dd className="text-right">{formatCLP(fee)}</dd>
              </>
            )}
            <dt className="text-muted-foreground">IVA incluido</dt>
            <dd className="text-right">{formatCLP(ivaIncluded(total))}</dd>
            <dt className="text-base font-semibold">Total</dt>
            <dd className="text-right text-base font-semibold">{formatCLP(total)}</dd>
          </dl>

          <Guard permission="tienda.vender">
            <Button
              size="lg"
              disabled={cart.length === 0}
              onClick={() => {
                setSale(
                  checkout({
                    items: cart.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: productOf(l.productId).price })),
                    ownerRut: customer?.rut,
                    payment,
                    delivery: delivery && customer ? { courier } : undefined,
                  })
                );
                reset();
              }}
            >
              Cobrar {formatCLP(total)}
            </Button>
          </Guard>
        </CardContent>
      </Card>

      <Dialog open={!!sale} onOpenChange={(o) => !o && setSale(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Venta registrada</DialogTitle>
          </DialogHeader>
          {sale && <Receipt sale={sale} />}
          <p className="text-xs text-muted-foreground">
            El stock de la sala se descontó. Si hay despacho, quedó en Tienda › Despachos.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => window.print()}><Printer /> Imprimir</Button>
            <Button onClick={() => setSale(null)}>Nueva venta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
