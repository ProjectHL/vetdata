# T7-1 — Preparación DTE

Estado: contrato local implementado; emisión real deshabilitada por ausencia de D-05. El responsable del proyecto decidió el 2026-10-12 retomar proveedor, adaptador y certificación en T8-7. Ningún proveedor falso se compila como adaptador productivo ni se registra un endpoint de emisión/callback.

## Contrato

`internal/dte.Provider`: Name, Issue, Lookup y VerifyEvent. Name identifica el espacio estable proveedor/cuenta configurado por el operador; referencias y eventos deben ser únicos dentro de ese espacio. El adaptador debe verificar autenticidad, antigüedad e identidad del evento antes de devolverlo. Request usa UUID de documento como clave estable externa, clínica, factura, tipo 39/33, montos e ítems. La selección del proveedor determinará campos fiscales adicionales y mapeos, sin inferir que la factura interna ya contiene todo lo requerido.

Migración 014: documentos, intentos y eventos. Una factura tiene como máximo un DTE preparado en esta entrega; cambios/reemplazos posteriores requieren flujo explícito. Clave idempotente por clínica, referencia única por proveedor; FK compuesta impide asociar factura ajena. Estados: pending → sending → accepted/issued/rejected, o uncertain por fallo. sending/uncertain exigen Lookup; no vuelven a Issue. Una caída después de reservar sending se recupera mediante reconciliación.

Resultados requieren referencia y revisión positiva; issued requiere folio y referencia del documento. El proveedor debe mapear su orden de eventos a una revisión monotónica verificable. Eventos antiguos no regresan el estado; issued/rejected son terminales en esta entrega. Callbacks repetidos son no-op; misma identidad con payload distinto produce conflicto. Eventos se conservan inmutables con hash, sin payload fiscal completo. Intentos conservan estado, no errores externos con datos sensibles.

## D-05 para el desarrollador

Registrar proveedor elegido, cuenta emisora/RUT por clínica, ambiente, credenciales por secretos, esquema de autenticación, idempotencia y Lookup después de timeout, orden de eventos, errores, URLs/documentos, reconciliación y capacidades de anulación. No habilitar tipos 61/52 ni asumir certificación. Sandbox/certificación deben probar tipos 39/33, rechazo, timeout, duplicado y reconciliación.

El fake existe solo en tests. No hay emisión real ni declaración de validez tributaria en esta entrega. Revisar requisitos externos con responsables antes de cambiar el estado a validada.
