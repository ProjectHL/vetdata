import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Agenda } from "@/components/agenda/agenda";

export default function AgendaPage() {
  return (
    <PageContainer>
      <PageHeader title="Agenda" description="Citas por profesional, con su estado real: por llegar, en sala de espera, en box o realizada." />
      <Agenda />
    </PageContainer>
  );
}
