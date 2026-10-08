import { Building2, Lock, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AccessLevel } from "@/domain/sharing";

export function AccessBadge({ level, origin }: { level: AccessLevel; origin?: string }) {
  if (level === "propio") {
    return (
      <Badge variant="outline" className="text-primary">
        <Building2 /> Propio
      </Badge>
    );
  }
  if (level === "compartido") {
    return (
      <Badge variant="secondary" className="max-w-full truncate">
        <Share2 /> Compartido{origin ? ` · ${origin}` : ""}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <Lock /> Sin acceso
    </Badge>
  );
}
