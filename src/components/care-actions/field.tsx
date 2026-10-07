import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const labelId = useId();
  // Sin htmlFor, el grupo toma el nombre de la etiqueta para que el control quede rotulado.
  return (
    <div
      className={cn("flex flex-col gap-1.5", className)}
      role={htmlFor ? undefined : "group"}
      aria-labelledby={htmlFor ? undefined : labelId}
    >
      <Label id={labelId} htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function SuccessPanel({
  title,
  children,
  onDone,
  extra,
}: {
  title: string;
  children: React.ReactNode;
  onDone: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <p className="font-medium text-primary">{title}</p>
        <div className="mt-2 text-sm">{children}</div>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {extra}
        <Button onClick={onDone}>Listo</Button>
      </div>
    </div>
  );
}
