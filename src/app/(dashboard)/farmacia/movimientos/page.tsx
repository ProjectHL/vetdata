import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { DispenseQueue } from "@/components/pharmacy/dispense-queue";
import { Kardex } from "@/components/pharmacy/kardex";

export default function MovimientosPage() {
  return (
    <PageContainer>
      <PageHeader title="Movimientos" description="Dispensación de recetas derivadas y registro de entradas y salidas de inventario." />
      <DispenseQueue />
      <Kardex />
    </PageContainer>
  );
}
