import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Mensaje de lista o tabla vacía, con ícono y acción siguiente opcionales. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground", className)}>
      {Icon && <Icon className="size-8" aria-hidden />}
      <p>{title}</p>
      {description && <p className="text-xs">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
