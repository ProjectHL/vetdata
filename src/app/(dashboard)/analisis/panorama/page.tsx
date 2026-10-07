import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Panorama } from "@/components/analytics/panorama";

export default function PanoramaPage() {
  return (
    <PageContainer>
      <PageHeader title="Panorama" description="Vista ejecutiva de la clínica: ingresos por línea de negocio, salud de cada área y lo que requiere atención." />
      <Panorama />
    </PageContainer>
  );
}
