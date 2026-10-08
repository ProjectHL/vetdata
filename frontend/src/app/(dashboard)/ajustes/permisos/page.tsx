import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PermissionsMatrix, SharingPolicyCard } from "@/components/settings/permissions-matrix";

export default function PermisosPage() {
  return (
    <PageContainer>
      <PageHeader title="Permisos" description="Qué puede hacer cada rol y cómo comparte datos tu clínica." />
      <PermissionsMatrix />
      <SharingPolicyCard />
    </PageContainer>
  );
}
