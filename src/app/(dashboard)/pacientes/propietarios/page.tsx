import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { OwnerList } from "@/components/owners/owner-list";

export default function PropietariosPage() {
  return (
    <PageContainer>
      <PageHeader title="Propietarios" description="Dueños registrados en la red y sus mascotas, vinculados por RUT." />
      <OwnerList />
    </PageContainer>
  );
}
