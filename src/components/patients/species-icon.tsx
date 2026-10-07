import { Bird, Cat, Dog, Rabbit } from "lucide-react";
import type { Species } from "@/domain/patients";

const icons = { Perro: Dog, Gato: Cat, Ave: Bird, Conejo: Rabbit } as const;

export function SpeciesIcon({ species, className }: { species: Species; className?: string }) {
  const Icon = icons[species];
  return <Icon className={className} />;
}
