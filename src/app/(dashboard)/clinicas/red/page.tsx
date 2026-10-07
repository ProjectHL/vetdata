import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ClinicDirectory } from "@/components/network/clinic-directory";
import { HowItWorks } from "@/components/network/how-it-works";
import { NetworkSearch } from "@/components/network/network-search";

export default async function RedPage(props: PageProps<"/clinicas/red">) {
  const { rut } = await props.searchParams;

  return (
    <PageContainer>
      <PageHeader title="Red de clínicas" description="Clínicas conectadas a VetData y búsqueda de pacientes en toda la red." />
      <HowItWorks />
      <NetworkSearch initialRut={typeof rut === "string" ? rut : ""} />
      <ClinicDirectory />
    </PageContainer>
  );
}
