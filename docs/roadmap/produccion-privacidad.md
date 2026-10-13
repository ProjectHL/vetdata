# T7-2 — Privacidad y exportación

## API

`GET /api/v1/owners/{rut}/export`: sesión Admin de clínica activa; verifica vínculo clinic_owners. JSON descargable `vetdata.owner-export.v1`, sin caché. RUT normalizado. 401 sin sesión, 403 rol, 404 sin vínculo, 409 si alguna categoría supera 10000 filas o el contenido supera 20 MiB (requiere exportación operativa revisada, nunca truncamiento silencioso).

Incluye contacto del dueño, saldo/notas de esa clínica, pacientes propios, registros clínicos propios, agenda, facturas/pagos, derivaciones, tienda/despachos y metadatos de adjuntos. No descarga binarios ni claves storage; no incluye sesiones, tokens, contraseñas ni mensajes cifrados. Los grants no autorizan exportar registros de otra clínica. Una clínica receptora conserva exportación de sus propios documentos/atenciones, sin incorporar la ficha ajena. Snapshot repeatable-read y auditoría de resultado/conteos sin copia del contenido. El evento completed acredita generación, no recepción del archivo por el usuario.

## Inventario y simulación

`ops --kind anonymization --clinic UUID --owner UUID --as-of 2026-10-11T00:00:00Z` usa transacción read-only. Devuelve conteos y motivos de conservación; no anonimiza. Herramienta exclusiva de operador con acceso DB, no endpoint público.

| Categoría | Localización | Tratamiento pendiente |
|---|---|---|
| Contacto global | owners, emergency_contact | D-07: identidad y alcance global; una clínica no puede borrar contacto usado por otra |
| Vínculo local | clinic_owners | Saldo, notas, preferencias; evaluar retención |
| Clínica/agenda | patients, clinical_records, appointments, access_entries, waiting_entries, referrals | Conservar obligaciones aprobadas; texto libre necesita revisión |
| Documentos comerciales | invoices/items, payments, retail_sales/lines, shipments, futuros DTE | Datos históricos y copias; retención aprobada antes de anonimizar |
| Consentimientos/lecturas | sharing_requests, sharing_grants, shared_read_audit | D-01/D-07; tokens jamás exportados |
| Auditorías | audit_events y eventos inmutables | No reescribir historia para simular anonimización |
| Notificaciones | notification_outbox cifrado | No existe atribución exhaustiva por dueño; requiere inventario específico |
| Adjuntos | attachments y futuro storage | Se exportan metadatos permitidos; binarios/AV pendientes Fase 8 |
| Copias | backups, proveedor DTE, exportaciones descargadas | Responsables, retención y eliminación fuera del alcance de una fila SQL |

La simulación marca categorías no contadas como revisión manual, no como ausencia de datos. Una solicitud global del titular, anonimización real y contrato de encargado requieren D-07, identidad verificada, alcance, responsable y fecha registrados. No existe ejecución destructiva en esta entrega.
