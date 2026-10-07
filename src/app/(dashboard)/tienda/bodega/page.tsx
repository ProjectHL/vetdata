import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { WarehouseView } from "@/components/retail/warehouse";

export default function BodegaPage() {
  return (
    <PageContainer>
      <PageHeader title="Bodega" description="Organización del inventario entre bodega central y sala de ventas." />
      <WarehouseView />
    </PageContainer>
  );
}
