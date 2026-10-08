import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PurchaseOrders, RestockSuggestions, SupplierDirectory } from "@/components/pharmacy/purchasing";

export default function ProveedoresPage() {
  return (
    <PageContainer>
      <PageHeader title="Proveedores" description="Reposición de inventario: sugerencias por stock mínimo y órdenes de compra." />
      <RestockSuggestions />
      <PurchaseOrders />
      <SupplierDirectory />
    </PageContainer>
  );
}
