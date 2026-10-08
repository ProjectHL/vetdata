import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ClinicProfileCard, UserProfile } from "@/components/settings/profile";

export default function PerfilPage() {
  return (
    <PageContainer width="narrow">
      <PageHeader title="Perfil" description="Tu cuenta y los datos de la clínica." />
      <UserProfile />
      <ClinicProfileCard />
    </PageContainer>
  );
}
