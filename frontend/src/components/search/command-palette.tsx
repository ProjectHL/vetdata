"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarPlus,
  FileText,
  Globe2,
  LifeBuoy,
  Lock,
  Package,
  Pill,
  Receipt,
  Search,
  ShoppingCart,
  Ticket,
  UserRound,
} from "lucide-react";
import { SpeciesIcon } from "@/components/patients/species-icon";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { useOwners, usePatients } from "@/lib/server-state";
import { ownerName } from "@/domain/owners";
import { formatRut, normalizeRut } from "@/lib/format";
import { todayAppointments } from "@/lib/metrics/day";
import { channels } from "@/lib/nav";
import { useRetail } from "@/lib/retail-store";
import { useCan, useCanView, useStore } from "@/lib/store";
import { useSupport } from "@/lib/support-store";

const MAX = 5;

type Result = { id: string; label: string; hint?: string; href: string; icon: React.ReactNode };

/** Abre el buscador con ⌘K / Ctrl+K desde cualquier pantalla. */
export function useCommandPaletteShortcut(open: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const can = useCan();
  const canView = useCanView();
  const { appointments, medications, invoices } = useStore();
  const { products, sales } = useRetail();
  const { tickets } = useSupport();
  const owners = useOwners();
  const patients = usePatients();
  const getOwner = (rut: string) => owners.find((o) => o.rut === rut);
  const getPatient = (id: string) => patients.find((p) => p.id === id);
  const petsOf = (ownerRut: string) => patients.filter((p) => p.ownerRut === ownerRut);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const rut = normalizeRut(query.trim());
  const digits = q.replace(/\D/g, "");
  const hasQuery = q.length >= 2;
  const looksLikeRut = /^\d{7,8}-?[\dk]?$/i.test(rut);
  const matchRut = (ownerRut: string) => digits.length >= 6 && (ownerRut.toUpperCase().startsWith(rut) || ownerRut.replace("-", "").startsWith(digits));

  const groups: { heading: string; items: Result[] }[] = [];
  const push = (heading: string, items: Result[]) => items.length && groups.push({ heading, items: items.slice(0, MAX) });

  if (hasQuery) {
    // Mascotas: respeta la regla de acceso de la red.
    push(
      "Mascotas",
      patients
        .filter((p) => p.name.toLowerCase().includes(q) || p.chip.includes(q) || p.breed.toLowerCase().includes(q) || matchRut(p.ownerRut))
        .map((p) =>
          canView(p.id)
            ? { id: `p-${p.id}`, label: p.name, hint: `${p.species} · ${p.breed} · ${ownerName(getOwner(p.ownerRut)!)}`, href: `/pacientes/historial/${p.id}`, icon: <SpeciesIcon species={p.species} /> }
            : { id: `p-${p.id}`, label: p.name, hint: `En la red · ${p.clinic} · solicitar acceso`, href: `/clinicas/red?rut=${p.ownerRut}`, icon: <Lock /> }
        )
    );
    push(
      "Propietarios",
      owners
        .filter((o) => ownerName(o).toLowerCase().includes(q) || matchRut(o.rut) || (digits.length >= 4 && o.phone.replace(/\D/g, "").includes(digits)))
        .map((o) => {
          const visible = petsOf(o.rut).some((p) => canView(p.id));
          return visible
            ? { id: `o-${o.rut}`, label: ownerName(o), hint: `${formatRut(o.rut)} · ${o.sector}`, href: `/pacientes/propietarios/${o.rut}`, icon: <UserRound /> }
            : { id: `o-${o.rut}`, label: ownerName(o), hint: `${formatRut(o.rut)} · en la red, sin acceso`, href: `/clinicas/red?rut=${o.rut}`, icon: <Globe2 /> };
        })
    );
    push(
      "Citas de hoy",
      todayAppointments(appointments)
        .filter((a) => a.status !== "Cancelada" && (getPatient(a.patientId)?.name.toLowerCase().includes(q) || a.reason.toLowerCase().includes(q)))
        .map((a) => ({ id: `a-${a.id}`, label: `${a.time} · ${getPatient(a.patientId)?.name}`, hint: a.reason, href: "/inicio/agenda", icon: <CalendarDays /> }))
    );
    if (can("tienda.vender") || can("tienda.inventario")) {
      push(
        "Productos de tienda",
        products
          .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q))
          .map((p) => ({ id: `t-${p.id}`, label: p.name, hint: `${p.sku} · sala ${p.stock.sala} · bodega ${p.stock.central}`, href: "/tienda/productos", icon: <Package /> }))
      );
    }
    if (can("farmacia.dispensar") || can("farmacia.inventario") || can("medicamentos.derivar")) {
      push(
        "Medicamentos",
        medications
          .filter((m) => m.name.toLowerCase().includes(q) || m.activeIngredient.toLowerCase().includes(q))
          .map((m) => ({ id: `m-${m.id}`, label: m.name, hint: `${m.activeIngredient} · stock ${m.stock}`, href: "/farmacia/medicamentos", icon: <Pill /> }))
      );
    }
    if (can("tienda.vender") && digits.length >= 3) {
      push(
        "Boletas",
        sales
          .filter((s) => String(s.number).includes(digits))
          .map((s) => ({ id: `s-${s.id}`, label: `Boleta ${s.number}`, hint: `${s.date} ${s.time}`, href: "/tienda/ventas", icon: <Receipt /> }))
      );
    }
    if (can("facturas.emitir") && digits.length >= 3) {
      push(
        "Facturas",
        invoices
          .filter((i) => String(i.folio).includes(digits))
          .map((i) => ({ id: `f-${i.id}`, label: `Factura N° ${i.folio}`, hint: ownerName(getOwner(i.ownerRut)!), href: `/pacientes/propietarios/${i.ownerRut}`, icon: <FileText /> }))
      );
    }
    if (can("soporte.crear")) {
      push(
        "Tickets de soporte",
        tickets
          .filter((t) => t.title.toLowerCase().includes(q) || `#${t.number}`.includes(q) || String(t.number).includes(digits || "-"))
          .map((t) => ({ id: `k-${t.id}`, label: `#${t.number} · ${t.title}`, hint: t.status, href: `/soporte/tickets/${t.id}`, icon: <Ticket /> }))
      );
    }
  }

  const actions: Result[] = [
    ...(hasQuery && looksLikeRut ? [{ id: "x-red", label: `Buscar RUT ${query.trim()} en la red de clínicas`, href: `/clinicas/red?rut=${rut}`, icon: <Globe2 /> }] : []),
    ...(can("tienda.vender") ? [{ id: "x-venta", label: "Nueva venta", href: "/tienda/venta", icon: <ShoppingCart /> }] : []),
    ...(can("agenda.gestionar") ? [{ id: "x-agenda", label: "Agendar cita", href: "/inicio/agenda", icon: <CalendarPlus /> }] : []),
    ...(can("soporte.crear") ? [{ id: "x-ticket", label: "Reportar un problema a VetData", href: "/soporte/tickets", icon: <LifeBuoy /> }] : []),
  ].filter((a) => !hasQuery || a.id === "x-red" || a.label.toLowerCase().includes(q));

  const pages: Result[] = channels
    .flatMap((c) => c.items.map((i) => ({ id: `n-${i.href}`, label: i.title, hint: c.title, href: i.href, icon: <i.icon /> })))
    .filter((p) => !hasQuery || p.label.toLowerCase().includes(q) || p.hint.toLowerCase().includes(q))
    .slice(0, hasQuery ? MAX : 6);

  const go = (href: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  };

  const renderGroup = (heading: string, items: Result[]) => (
    <CommandGroup key={heading} heading={heading}>
      {items.map((r) => (
        <CommandItem key={r.id} value={r.id} onSelect={() => go(r.href)}>
          {r.icon}
          <span className="truncate">{r.label}</span>
          {r.hint && <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">{r.hint}</span>}
        </CommandItem>
      ))}
    </CommandGroup>
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQuery("");
      }}
      title="Buscar en VetData"
      description="Mascotas, dueños, citas, productos, boletas, tickets y páginas"
      className="sm:max-w-xl"
    >
      <Command shouldFilter={false}>
        <CommandInput value={query} onValueChange={setQuery} placeholder="Mascota, RUT, producto, boleta, ticket o página…" />
        <CommandList className="max-h-[60svh]">
          <CommandEmpty>Sin resultados para “{query}”.</CommandEmpty>
          {groups.map((g) => renderGroup(g.heading, g.items))}
          {actions.length > 0 && renderGroup("Acciones", actions)}
          {pages.length > 0 && renderGroup(hasQuery ? "Ir a" : "Ir a (sugerido)", pages)}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

export function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hidden h-9 w-72 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent md:flex"
    >
      <Search className="size-4" />
      <span className="flex-1 text-left">Buscar mascota, RUT, producto…</span>
      <CommandShortcut className="rounded border bg-muted px-1.5 py-0.5 text-[10px] tracking-normal">⌘K</CommandShortcut>
    </button>
  );
}
