import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { TaskInbox } from "@/components/tasks/task-inbox";

export default function PendientesPage() {
  return (
    <PageContainer width="narrow">
      <PageHeader title="Pendientes" description="Todo lo que espera acción en la clínica, la red, farmacia, tienda, seguridad y soporte, en una sola bandeja." />
      <TaskInbox />
    </PageContainer>
  );
}
