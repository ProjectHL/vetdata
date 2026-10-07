import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { RequirePermission } from "@/components/settings/guard";

/** Encabezado + verificación de permiso común a las páginas de Seguridad. */
export function SecurityPage({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <PageContainer>
      <PageHeader title={title} description={description} />
      <RequirePermission permission="seguridad.ver" message="Tu rol no tiene acceso a las cámaras de seguridad. Pide el permiso a un administrador.">
        {children}
      </RequirePermission>
    </PageContainer>
  );
}
