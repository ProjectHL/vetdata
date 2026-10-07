import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { RetailPurchasing } from "@/components/retail/purchasing";

export default function ComprasPage() {
  return (
    <PageContainer>
      <PageHeader title="Compras" description="Abastecimiento de la tienda: sugerencias, órdenes de compra y proveedores." />
      <RetailPurchasing />
    </PageContainer>
  );
}
