import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Shipments } from "@/components/retail/shipments";

export default function DespachosPage() {
  return (
    <PageContainer>
      <PageHeader title="Despachos" description="Logística de pedidos a domicilio: preparar, despachar y confirmar la entrega." />
      <Shipments />
    </PageContainer>
  );
}
