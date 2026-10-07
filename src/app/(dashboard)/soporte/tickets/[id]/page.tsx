import { PageContainer } from "@/components/layout/page-container";
import { TicketDetail } from "@/components/support/ticket-detail";

export default async function TicketPage(props: PageProps<"/soporte/tickets/[id]">) {
  const { id } = await props.params;
  return (
    <PageContainer>
      <TicketDetail id={id} />
    </PageContainer>
  );
}
