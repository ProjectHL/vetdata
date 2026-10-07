"use client";

import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PERMISSIONS, type Permission } from "@/domain/settings";
import { useCan, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Envuelve una acción que requiere permiso. Sin permiso la muestra deshabilitada
 * con un tooltip que explica qué rol/permiso falta.
 */
export function Guard({
  permission,
  children,
  className,
}: {
  permission: Permission;
  children: React.ReactNode;
  className?: string;
}) {
  const can = useCan();
  const { role } = useStore();
  if (can(permission)) return <>{children}</>;
  const label = PERMISSIONS.find((p) => p.id === permission)?.label;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cn("inline-flex cursor-not-allowed", className)}>
          <span inert className="pointer-events-none flex w-full opacity-50 [&>*]:w-full">
            {children}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <Lock className="mr-1 inline size-3" />
        Rol {role} sin permiso: {label}
      </TooltipContent>
    </Tooltip>
  );
}

/** Muestra el contenido solo con permiso; si no, un aviso de acceso restringido. */
export function RequirePermission({
  permission,
  children,
  message,
}: {
  permission: Permission;
  children: React.ReactNode;
  message?: string;
}) {
  const can = useCan();
  const { role } = useStore();
  if (can(permission)) return <>{children}</>;
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
      <Lock className="size-6" />
      <p>{message ?? `Tu rol (${role}) no tiene acceso a esta información.`}</p>
    </div>
  );
}
