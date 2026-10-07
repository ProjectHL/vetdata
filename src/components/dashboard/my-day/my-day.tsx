"use client";

import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { CalendarDays, Cctv, Gauge, ListChecks, Pill, Search, ShoppingCart, Truck, Users, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Role } from "@/domain/settings";
import { NOW_TIME, TODAY, formatDate } from "@/lib/format";
import { useStore } from "@/lib/store";
import { AdminDay } from "./admin";
import { PharmacyDay } from "./pharmacy";
import { ReceptionDay } from "./reception";
import { VetDay } from "./vet";

const QUICK: Record<Role, { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[]> = {
  Veterinario: [
    { label: "Agenda", href: "/inicio/agenda", icon: CalendarDays },
    { label: "Pendientes", href: "/inicio/pendientes", icon: ListChecks },
    { label: "Buscar paciente", href: "/pacientes/mascotas", icon: Search },
  ],
  Recepción: [
    { label: "Agenda", href: "/inicio/agenda", icon: CalendarDays },
    { label: "Nueva venta", href: "/tienda/venta", icon: ShoppingCart },
    { label: "Sala de espera", href: "/seguridad/sala-espera", icon: Users },
  ],
  Farmacia: [
    { label: "Dispensar", href: "/farmacia/movimientos", icon: Pill },
    { label: "Proveedores", href: "/farmacia/proveedores", icon: Truck },
    { label: "Bodega tienda", href: "/tienda/bodega", icon: Warehouse },
  ],
  Admin: [
    { label: "Panorama", href: "/analisis/panorama", icon: Gauge },
    { label: "Pendientes", href: "/inicio/pendientes", icon: ListChecks },
    { label: "Monitoreo", href: "/seguridad/monitoreo", icon: Cctv },
  ],
};

export function MyDay() {
  const { currentUser, role } = useStore();
  const greeting = NOW_TIME < "12:00" ? "Buenos días" : NOW_TIME < "20:00" ? "Buenas tardes" : "Buenas noches";
  const firstName = currentUser.name.replace(/^(Dra?\.)\s/, "").split(" ")[0];

  return (
    <PageContainer>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{formatDate(TODAY)} · {NOW_TIME} h</p>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {greeting}, {firstName} <Badge variant="secondary">{role}</Badge>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK[role].map((q) => (
            <Button key={q.href} variant="outline" asChild>
              <Link href={q.href}><q.icon /> {q.label}</Link>
            </Button>
          ))}
        </div>
      </div>
      {role === "Veterinario" && <VetDay />}
      {role === "Recepción" && <ReceptionDay />}
      {role === "Farmacia" && <PharmacyDay />}
      {role === "Admin" && <AdminDay />}
    </PageContainer>
  );
}
