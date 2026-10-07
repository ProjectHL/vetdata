import { cn } from "@/lib/utils";

const widths = {
  default: "max-w-7xl",
  narrow: "max-w-5xl",
} as const;

/** Contenedor centrado de cada página del dashboard. */
export function PageContainer({
  width = "default",
  className,
  children,
}: {
  width?: keyof typeof widths;
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("mx-auto flex flex-col gap-6", widths[width], className)}>{children}</div>;
}
