"use client";

import { useState } from "react";
import { Field } from "@/components/care-actions/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Medication } from "@/domain/medications";
import type { MovementReason } from "@/domain/pharmacy";
import { useStore } from "@/lib/store";
import { dataSource } from "@/services";
import { ApiError } from "@/services/http/client";

const REASONS: MovementReason[] = ["Merma", "Vencimiento"];

/** Ajuste negativo de inventario (merma o vencimiento). Queda registrado en Movimientos. */
export function AdjustStockDialog({
  medication,
  onOpenChange,
}: {
  medication: Medication | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { adjustStock } = useStore();
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState<MovementReason>("Merma");
  const [lotId, setLotId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lots = medication?.lots?.filter((lot) => lot.qty > 0) ?? [];
  const selectedLot = lots.find((lot) => lot.id === lotId);
  const maxQty = dataSource === "http" ? selectedLot?.qty ?? 0 : medication?.stock ?? 0;

  return (
    <Dialog open={!!medication} onOpenChange={(open) => {
      if (!open) { setLotId(""); setError(""); }
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-sm">
        {medication && (
          <>
            <DialogHeader>
              <DialogTitle>Ajustar stock</DialogTitle>
              <DialogDescription>
                {medication.name} · stock actual {medication.stock} {medication.unit}
              </DialogDescription>
            </DialogHeader>
            {dataSource === "http" && (
              <Field label="Lote">
                <Select value={lotId} onValueChange={(value) => { setLotId(value); setQty(1); setError(""); }}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona un lote" /></SelectTrigger>
                  <SelectContent>
                    {lots.map((lot) => <SelectItem key={lot.id} value={lot.id}>{lot.lot} · {lot.qty} disponibles · {lot.expiry ?? "sin vencimiento"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Motivo">
                <Select value={reason} onValueChange={(v) => setReason(v as MovementReason)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Cantidad a descontar" htmlFor="adj-qty">
                <Input
                  id="adj-qty"
                  type="number"
                  min={1}
                  max={maxQty}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)))}
                />
              </Field>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button
                disabled={saving || maxQty === 0 || qty > maxQty}
                onClick={async () => {
                  setSaving(true);
                  setError("");
                  try {
                    await adjustStock(medication.id, -qty, reason, selectedLot?.id);
                    setQty(1);
                    setLotId("");
                    onOpenChange(false);
                  } catch (cause) {
                    setError(cause instanceof ApiError && cause.status === 409
                      ? "El stock del lote cambió. Se actualizaron las existencias; selecciona un lote disponible."
                      : cause instanceof Error ? cause.message : "No se pudo registrar el ajuste.");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Registrando…" : "Registrar ajuste"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
