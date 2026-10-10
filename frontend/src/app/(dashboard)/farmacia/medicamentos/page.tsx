"use client";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { MedicationTable } from "@/components/pharmacy/medication-table";
import { useCurrentClinic } from "@/lib/server-state";

export default function MedicamentosPage() {
  const currentClinic = useCurrentClinic();
  return (
    <PageContainer>
      <PageHeader title="Medicamentos" description={<>Inventario disponible en {currentClinic}.</>} />
      <MedicationTable />
    </PageContainer>
  );
}
