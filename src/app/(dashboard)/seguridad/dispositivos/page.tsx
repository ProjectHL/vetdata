import { Devices } from "@/components/security/devices";
import { SecurityPage } from "@/components/security/page-shell";

export default function DispositivosPage() {
  return (
    <SecurityPage title="Dispositivos" description="Cámaras, sensores, cerraduras y grabador; configuración de privacidad y retención, y auditoría.">
      <Devices />
    </SecurityPage>
  );
}
