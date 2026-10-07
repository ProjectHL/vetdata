import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { MedicationTable } from "@/components/pharmacy/medication-table";
import { currentClinic } from "@/lib/lookups";

export default function MedicamentosPage() {
  return (
    <PageContainer>
      <PageHeader title="Medicamentos" description={<>Inventario disponible en {currentClinic}.</>} />
      <MedicationTable />
    </PageContainer>
  );
}
