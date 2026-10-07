import { SecurityPage } from "@/components/security/page-shell";
import { WaitingZone } from "@/components/security/zones";

export default function WaitingPage() {
  return (
    <SecurityPage title="Sala de espera" description="Aforo, tiempos de espera y alertas de manejo; desde aquí se llama al paciente a su box.">
      <WaitingZone />
    </SecurityPage>
  );
}
