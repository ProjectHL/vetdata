import { Monitoring } from "@/components/security/monitoring";
import { SecurityPage } from "@/components/security/page-shell";

export default function MonitoreoPage() {
  return (
    <SecurityPage title="Centro de monitoreo" description="Todas las cámaras de la clínica, estado de la alarma y eventos en vivo.">
      <Monitoring />
    </SecurityPage>
  );
}
