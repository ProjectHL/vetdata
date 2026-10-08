import { SecurityEvents } from "@/components/security/events";
import { SecurityPage } from "@/components/security/page-shell";

export default async function EventosPage(props: PageProps<"/seguridad/eventos">) {
  const { id } = await props.searchParams;
  return (
    <SecurityPage title="Eventos" description="Alertas e incidentes de seguridad: revisión, responsable, bitácora y clips.">
      <SecurityEvents initialId={typeof id === "string" ? id : undefined} />
    </SecurityPage>
  );
}
