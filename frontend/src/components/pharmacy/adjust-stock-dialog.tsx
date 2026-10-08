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

  return (
    <Dialog open={!!medication} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {medication && (
          <>
            <DialogHeader>
              <DialogTitle>Ajustar stock</DialogTitle>
              <DialogDescription>
                {medication.name} · stock actual {medication.stock} {medication.unit}
              </DialogDescription>
            </DialogHeader>
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
                  max={medication.stock}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Math.min(medication.stock, Number(e.target.value) || 1)))}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button
                disabled={medication.stock === 0}
                onClick={() => {
                  adjustStock(medication.id, -qty, reason);
                  setQty(1);
                  onOpenChange(false);
                }}
              >
                Registrar ajuste
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
