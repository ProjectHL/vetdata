import { SecurityPage } from "@/components/security/page-shell";
import { StoreZone } from "@/components/security/zones";

export default function SeguridadTiendaPage() {
  return (
    <SecurityPage title="Tienda" description="Caja, pasillos y bodega de la tienda, con acceso al video de cada boleta.">
      <StoreZone />
    </SecurityPage>
  );
}
