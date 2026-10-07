import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PatientList } from "@/components/patients/patient-list";

export default function HistorialPage() {
  return (
    <PageContainer>
      <PageHeader title="Historial clínico" description="Fichas de pacientes compartidas por la red de clínicas." />
      <PatientList />
    </PageContainer>
  );
}
