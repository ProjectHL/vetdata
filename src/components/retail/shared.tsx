import { ArrowRightLeft, BedDouble, CheckCircle2, Cookie, Droplets, Drumstick, PackageX, Puzzle, Shirt, ShoppingCart, Tag, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ProductCategory, StockLevel } from "@/domain/retail";
import { cn } from "@/lib/utils";

const categoryIcon: Record<ProductCategory, LucideIcon> = {
  Alimentos: Drumstick,
  Snacks: Cookie,
  Accesorios: Tag,
  Ropa: Shirt,
  Juguetes: Puzzle,
  Higiene: Droplets,
  "Camas y transporte": BedDouble,
};

export function ProductThumb({ category, className }: { category: ProductCategory; className?: string }) {
  const Icon = categoryIcon[category];
  return (
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary", className)}>
      <Icon className="size-5" />
    </span>
  );
}

const levelVariant: Record<StockLevel, "default" | "secondary" | "destructive" | "outline"> = {
  OK: "outline",
  "Reponer sala": "secondary",
  Comprar: "destructive",
  Agotado: "destructive",
};

const levelIcon: Record<StockLevel, LucideIcon> = {
  OK: CheckCircle2,
  "Reponer sala": ArrowRightLeft,
  Comprar: ShoppingCart,
  Agotado: PackageX,
};

export function StockLevelBadge({ level }: { level: StockLevel }) {
  const Icon = levelIcon[level];
  return (
    <Badge variant={levelVariant[level]}>
      <Icon /> {level === "OK" ? "Stock OK" : level}
    </Badge>
  );
}
