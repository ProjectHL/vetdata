import { ArrowRight, Building2, KeyRound, Search, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  { icon: Search, title: "1. Buscar por RUT", text: "Ingresa el RUT del dueño y verás sus mascotas en toda la red (solo nombre, especie y clínica de origen)." },
  { icon: Send, title: "2. Solicitar acceso", text: "Eliges alcance (ficha completa o resumen clínico), vigencia y motivo." },
  { icon: Building2, title: "3. Origen aprueba", text: "La clínica de origen revisa la solicitud y la aprueba con el consentimiento del dueño." },
  { icon: KeyRound, title: "4. Acceso compartido", text: "La mascota y su dueño aparecen en tu clínica hasta que vence o el origen revoca el acceso." },
];

export function HowItWorks() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>¿Cómo se comparten los datos?</CardTitle>
        <CardDescription>
          Cada mascota pertenece a su clínica de origen. Otra clínica solo ve la ficha con un acceso vigente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3 md:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="relative flex flex-col gap-2 rounded-xl bg-muted/60 p-4">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <s.icon className="size-4" />
              </span>
              <p className="text-sm font-semibold">{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.text}</p>
              {i < steps.length - 1 && (
                <ArrowRight className="absolute top-1/2 -right-3 z-10 hidden size-4 -translate-y-1/2 text-muted-foreground md:block" />
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
