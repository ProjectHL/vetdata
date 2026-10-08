import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { SalesReport } from "@/components/retail/sales-report";

export default function VentasPage() {
  return (
    <PageContainer>
      <PageHeader title="Ventas" description="Boletas emitidas en mesón y tienda web, por día, categoría y producto." />
      <SalesReport />
    </PageContainer>
  );
}
