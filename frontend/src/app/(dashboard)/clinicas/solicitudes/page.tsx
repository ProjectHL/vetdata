import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { RequestTabs } from "@/components/sharing/request-tabs";

export default function SolicitudesPage() {
  return (
    <PageContainer>
      <PageHeader title="Solicitudes" description="Pedidos de acceso a fichas entre clínicas de la red." />
      <RequestTabs />
    </PageContainer>
  );
}
