"use client";

import { useRouter } from "next/navigation";
import { Building2, PawPrint, Share2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const highlights = [
  { icon: PawPrint, text: "Ficha única de cada mascota, sin importar dónde se atienda." },
  { icon: Share2, text: "Historial clínico y vacunas compartidos entre clínicas." },
  { icon: ShieldCheck, text: "Accesos controlados por clínica y por profesional." },
];

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col p-6 sm:p-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle className="text-xl">Iniciar sesión</CardTitle>
              <CardDescription>Ingresa con tu cuenta de clínica.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  router.push("/dashboard");
                }}
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Correo</Label>
                  <Input id="email" type="email" placeholder="dra.rivas@clinica.cl" autoComplete="email" />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Contraseña</Label>
                    <a href="#" className="text-xs text-primary hover:underline">
                      ¿La olvidaste?
                    </a>
                  </div>
                  <Input id="password" type="password" autoComplete="current-password" />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="remember" />
                  <Label htmlFor="remember" className="font-normal">Recordarme</Label>
                </div>
                <Button type="submit" className="w-full">Ingresar</Button>
              </form>
            </CardContent>
          </Card>
        </div>
        <p className="text-center text-xs text-muted-foreground">© 2026 VetData</p>
      </div>

      <div className="relative hidden flex-col justify-end overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <PawPrint className="absolute -top-10 -right-10 size-80 opacity-10" />
        <Building2 className="absolute top-1/3 left-10 size-24 opacity-10" />
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight">
            Datos de mascotas compartidos entre clínicas
          </h2>
          <ul className="mt-6 flex flex-col gap-3">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-primary-foreground/90">
                <Icon className="mt-0.5 size-4 shrink-0" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
