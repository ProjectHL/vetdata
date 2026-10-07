import type { KeyboardEvent } from "react";

/**
 * Props para una fila de tabla que se activa con clic o teclado (Enter / Espacio).
 * Ignora las teclas que vienen de controles internos (botones, enlaces) de la fila.
 */
export function clickableRow(onActivate: () => void) {
  return {
    tabIndex: 0,
    className: "cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
    onClick: onActivate,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    },
  };
}
