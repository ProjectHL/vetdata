import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ClinicActivity } from "@/components/activity/clinic-activity";
import { currentClinic } from "@/lib/lookups";

export default function ActividadPage() {
  return (
    <PageContainer>
      <PageHeader title="Actividad" description={<>{currentClinic} · ocupación de boxes y atenciones en curso.</>} />
      <ClinicActivity />
    </PageContainer>
  );
}
