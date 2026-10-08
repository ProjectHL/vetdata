import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Catalog } from "@/components/retail/catalog";

export default function ProductosPage() {
  return (
    <PageContainer>
      <PageHeader title="Productos" description="Catálogo de la tienda: alimentos, accesorios, ropa, juguetes e higiene, con stock en sala y bodega." />
      <Catalog />
    </PageContainer>
  );
}
