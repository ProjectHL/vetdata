import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Releases } from "@/components/support/releases";

export default function NovedadesPage() {
  return (
    <PageContainer>
      <PageHeader title="Novedades" description="Lo nuevo en VetData, versión por versión." />
      <Releases />
    </PageContainer>
  );
}
