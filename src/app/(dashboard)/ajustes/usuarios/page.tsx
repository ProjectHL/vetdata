import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { UsersTable } from "@/components/settings/users-table";

export default function UsuariosPage() {
  return (
    <PageContainer>
      <PageHeader title="Usuarios" description="Equipo de la clínica, roles y estado de cada cuenta." />
      <UsersTable />
    </PageContainer>
  );
}
