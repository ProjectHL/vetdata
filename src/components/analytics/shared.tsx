"use client";

import { Download, Globe2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChartConfig } from "@/components/ui/chart";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

/** Series estándar: Mi clínica (viz-1) vs Red (viz-2). Colores validados para CVD y contraste. */
export const clinicVsNetwork = {
  clinica: { label: "Mi clínica", color: "var(--viz-1)" },
  red: { label: "Red VetData", color: "var(--viz-2)" },
} satisfies ChartConfig;

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          {Icon && <Icon className={cn("size-4", tone ?? "text-primary")} />}
          {label}
        </CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardHeader>
    </Card>
  );
}

/** Marca un dato como agregado anónimo de la red. */
export function NetworkTag() {
  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      <Globe2 /> Red VetData · agregado anónimo
    </Badge>
  );
}

export function ExportButton({ filename, rows }: { filename: string; rows: Record<string, string | number>[] }) {
  return (
    <Button size="sm" variant="outline" onClick={() => downloadCsv(filename, rows)} className="print:hidden">
      <Download /> CSV
    </Button>
  );
}
