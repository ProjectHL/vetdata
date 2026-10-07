import { SecurityPage } from "@/components/security/page-shell";
import { BoxesZone } from "@/components/security/zones";

export default function BoxesPage() {
  return (
    <SecurityPage title="Boxes" description="Cámaras de boxes y quirófano sincronizadas con el mapa de Actividad, con privacidad durante la atención.">
      <BoxesZone />
    </SecurityPage>
  );
}
