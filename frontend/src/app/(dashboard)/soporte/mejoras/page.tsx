import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { IdeasBoard } from "@/components/support/ideas-board";

export default function MejorasPage() {
  return (
    <PageContainer>
      <PageHeader title="Mejoras" description="Ideas de producto propuestas y votadas por las clínicas de la red." />
      <IdeasBoard />
    </PageContainer>
  );
}
