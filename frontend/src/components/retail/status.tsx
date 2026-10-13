"use client";

import { Button } from "@/components/ui/button";
import { useRetail } from "@/lib/retail-store";
import { dataSource } from "@/services";

export function RetailStatus({ children }: { children: React.ReactNode }) {
  const { loading, error, retry } = useRetail();
  if (dataSource === "mock") return children;
  return <>
    {loading && <p role="status" className="mb-4 rounded-lg border px-4 py-3 text-sm">Cargando tienda…</p>}
    {error && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 px-4 py-3 text-sm text-destructive">
      <span>{error}</span><Button size="sm" variant="outline" onClick={retry}>Actualizar datos</Button>
    </div>}
    {children}
  </>;
}
