import { cn } from "@/lib/utils";

/** Encabezado estándar de página: título, descripción y acciones opcionales a la derecha. */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Texto pequeño sobre el título (p. ej. el canal). */
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const heading = (
    <div>
      {eyebrow && <p className="text-sm text-muted-foreground">{eyebrow}</p>}
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );

  if (!actions) return className ? <div className={className}>{heading}</div> : heading;

  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      {heading}
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}
