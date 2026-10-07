import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Diagnoses } from "@/components/analytics/diagnoses";

export default function DiagnosticosPage() {
  return (
    <PageContainer>
      <PageHeader title="Diagnósticos" description="Tendencias clínicas de tu clínica y alertas epidemiológicas agregadas de la red." />
      <Diagnoses />
    </PageContainer>
  );
}
