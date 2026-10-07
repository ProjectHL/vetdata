import { SecurityPage } from "@/components/security/page-shell";
import { HallZone } from "@/components/security/zones";

export default function HallPage() {
  return (
    <SecurityPage title="Hall y entrada" description="Cámaras de acceso, registro de ingresos y salidas, llegadas esperadas y control de la puerta.">
      <HallZone />
    </SecurityPage>
  );
}
