import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { SharedTabs } from "@/components/sharing/shared-tabs";

export default function CompartidosPage() {
  return (
    <PageContainer>
      <PageHeader title="Compartidos" description="Accesos a fichas entre clínicas: lo que otras clínicas comparten contigo y lo que tú compartes." />
      <SharedTabs />
    </PageContainer>
  );
}
