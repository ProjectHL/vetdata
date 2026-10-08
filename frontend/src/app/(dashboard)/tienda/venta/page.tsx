import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PointOfSale } from "@/components/retail/pos";

export default function VentaPage() {
  return (
    <PageContainer>
      <PageHeader title="Punto de venta" description="Vende desde la sala, asocia la venta al RUT del dueño y ofrece despacho a domicilio." />
      <PointOfSale />
    </PageContainer>
  );
}
