"use client";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ClinicActivity } from "@/components/activity/clinic-activity";
import { useCurrentClinic } from "@/lib/server-state";

export default function ActividadPage() {
  const currentClinic = useCurrentClinic();
  return (
    <PageContainer>
      <PageHeader title="Actividad" description={<>{currentClinic} · ocupación de boxes y atenciones en curso.</>} />
      <ClinicActivity />
    </PageContainer>
  );
}
