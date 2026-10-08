import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PetBrowser } from "@/components/pets/pet-browser";

export default function MascotasPage() {
  return (
    <PageContainer>
      <PageHeader title="Mascotas" description="Pacientes de la red. Selecciona una mascota para agendar, facturar o derivar medicamentos." />
      <PetBrowser />
    </PageContainer>
  );
}
