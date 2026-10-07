import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Customers } from "@/components/analytics/customers";

export default function ClientesPage() {
  return (
    <PageContainer>
      <PageHeader title="Clientes y pacientes" description="Actividad de pacientes, composición de la cartera, mejores clientes y cobranza." />
      <Customers />
    </PageContainer>
  );
}
