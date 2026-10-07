import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { TicketList } from "@/components/support/ticket-list";

export default function TicketsPage() {
  return (
    <PageContainer>
      <PageHeader title="Tickets" description="Incidencias, consultas y mejoras enviadas al equipo de VetData." />
      <TicketList />
    </PageContainer>
  );
}
