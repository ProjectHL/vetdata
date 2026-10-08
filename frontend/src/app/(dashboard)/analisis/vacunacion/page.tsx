import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Vaccination } from "@/components/analytics/vaccination";

export default function VacunacionPage() {
  return (
    <PageContainer>
      <PageHeader title="Vacunación" description="Cobertura de tu clínica frente a la red y pacientes que requieren acción." />
      <Vaccination />
    </PageContainer>
  );
}
