"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Building2, PawPrint, Share2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dataSource } from "@/services";
import { apiFetch, ApiError } from "@/services/http/client";

const highlights = [
  { icon: PawPrint, text: "Ficha única de cada mascota, sin importar dónde se atienda." },
  { icon: Share2, text: "Historial clínico y vacunas compartidos entre clínicas." },
  { icon: ShieldCheck, text: "Accesos controlados por clínica y por profesional." },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dataSource === "mock") {
      router.push("/dashboard");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      if (challengeToken) {
        await apiFetch("/api/v1/auth/mfa/verify", {
          method: "POST",
          body: { challengeToken, code },
        });
      } else {
        const result = await apiFetch<{ authenticated?: boolean; twoFactorRequired?: boolean; challengeToken?: string }>(
          "/api/v1/auth/login",
          { method: "POST", body: { email, password } },
        );
        if (result.twoFactorRequired && result.challengeToken) {
          setChallengeToken(result.challengeToken);
          setPassword("");
          return;
        }
        if (!result.authenticated) throw new Error("No se pudo iniciar sesión");
      }
      router.replace("/dashboard");
    } catch (cause) {
      const body = cause instanceof ApiError ? cause.body : null;
      const apiError = body && typeof body === "object" && "error" in body ? body.error : null;
      setError(apiError && typeof apiError === "object" && "message" in apiError
        ? String(apiError.message)
        : "No se pudo iniciar sesión. Revisa tus datos e intenta nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

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
                onSubmit={submit}
              >
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                {challengeToken ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="code">Código de recuperación 2FA</Label>
                    <Input id="code" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" required />
                  </div>
                ) : (
                  <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Correo</Label>
                  <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Contraseña</Label>
                    <a href="#" className="text-xs text-primary hover:underline">
                      ¿La olvidaste?
                    </a>
                  </div>
                  <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="remember" />
                  <Label htmlFor="remember" className="font-normal">Recordarme</Label>
                </div>
                  </>
                )}
                <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Ingresando…" : challengeToken ? "Verificar código" : "Ingresar"}</Button>
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
