"use client";

import Link from "next/link";
import { dataSource } from "@/services";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

export function ApiGate({ children }: { children: React.ReactNode }) {
  const { loading, error, retry } = useStore();
  if (dataSource === "mock") return children;
  if (loading) return <main className="flex min-h-svh items-center justify-center p-6">Cargando datos de la clínica…</main>;
  if (error) return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <p role="alert">No se pudieron cargar los datos de la clínica.</p>
      <div className="flex gap-3">
        <Button onClick={retry}>Reintentar</Button>
        <Button variant="outline" asChild><Link href="/login">Iniciar sesión</Link></Button>
      </div>
    </main>
  );
  return children;
}
