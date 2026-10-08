import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Reports } from "@/components/analytics/reports";

export default function ReportesPage() {
  return (
    <PageContainer>
      <PageHeader title="Reportes" description="Indicadores financieros, operativos, de farmacia y de intercambio con la red." />
      <Reports />
    </PageContainer>
  );
}
