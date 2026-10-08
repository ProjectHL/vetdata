import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { RetailAnalytics } from "@/components/analytics/retail-analytics";

export default function AnalisisTiendaPage() {
  return (
    <PageContainer>
      <PageHeader title="Tienda" description="Ventas, rentabilidad, inventario y logística de la tienda, últimos 14 días." />
      <RetailAnalytics />
    </PageContainer>
  );
}
