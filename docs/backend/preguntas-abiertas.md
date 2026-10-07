# Preguntas abiertas y simulaciones del prototipo

> Todo lo que el prototipo **simula**, **fija** o **no resuelve**. Cada ítem tiene un id estable (`#p-NN`) referenciado desde el resto de la documentación. "Decide" = quién debería resolverlo (Negocio / Legal / Dev).

## A. Identidad, tenants y acceso

### p-01 · Autenticación, invitaciones y sesión — Decide: Dev + Negocio
- Login simulado: `src/app/login/page.tsx` redirige a `/dashboard` sin validar correo ni contraseña.
- `settings.inviteUser` no envía nada; "Marcar aceptada" lo hace un admin (`users-table.tsx`).
- `src/services/http/client.ts`: TODO "agregar el token de sesión… cookie httpOnly o header".
- Definir: mecanismo (cookie httpOnly + CSRF vs bearer), expiración, recuperación de contraseña, 2FA (recomendado para Admin y acceso a cámaras), SSO, aceptación de invitación con expiración, bloqueo por intentos.

### p-02 · Multi-sucursal y usuarios en varias clínicas — Decide: Negocio
- Hoy: un usuario = una clínica, una clínica = una sede. `MovementReason` incluye `Transferencia` sin uso (¿traspasos entre sucursales?).
- ¿Una cadena con varias sedes es un tenant con sucursales o varios tenants? ¿Comparten inventario, fichas (sin solicitud de red) y usuarios? ¿Un veterinario puede trabajar en dos clínicas con roles distintos (selector de clínica activa)?

### p-03 · Propiedad del dato del dueño y de los registros clínicos creados por otra clínica — Decide: Negocio + Legal
- `Owner` no tiene clínica; se identifica por RUT y sus mascotas pueden estar en varias clínicas (`network-search.tsx`).
- Las consultas de una mascota incluyen consultas hechas por otras clínicas (`Consultation.clinic`, p. ej. `p-001` en `src/mocks/patients.ts`).
- Definir: ¿el dueño es un registro global de la red o uno por clínica? Si la clínica B (con acceso compartido) registra una consulta, ¿de quién es? ¿La ve la clínica de origen? ¿Se puede "transferir" la clínica de origen (semilla `q05`: "Dueña se cambió de clínica")?

### p-04 · Qué ve una clínica sin acceso, y después de un acceso — Decide: Negocio + Legal
- Sin acceso la UI muestra nombre, especie, raza y clínica de origen (`access-gate.tsx:LockedRecord`) y, en la búsqueda por RUT, nombre del dueño y sector (`network-search.tsx`).
- Definir la **tarjeta mínima** exacta y si buscar por RUT ajeno debe auditarse o limitarse (enumeración de RUTs).
- Al revocar/vencer: ¿qué sigue viendo la receptora de sus propias citas, facturas y derivaciones sobre esa mascota?

### p-05 · Ciclo de vida de solicitudes y accesos — Decide: Negocio
- No existe: cancelar una solicitud enviada, expiración de solicitudes pendientes, renovar/extender un acceso (hoy: nueva solicitud, semilla `q03`), aviso de "acceso por vencer", cambiar alcance de un acceso vigente.
- ¿Puede la clínica de origen otorgar acceso proactivamente sin solicitud?

### p-06 · Consentimiento del dueño — Decide: Legal + Negocio
- `Owner.shareConsent` es un booleano sin fecha, medio ni evidencia; no hay operación para registrarlo o revocarlo.
- La declaración "Confirmo que el dueño autorizó (firma o SMS)" del diálogo de aprobación (`request-tabs.tsx`) **no se envía al backend**.
- Definir: modelo de consentimiento (general vs por solicitud), medios válidos (firma en mesón, SMS con código, link), evidencia almacenada, revocación del consentimiento (¿revoca grants vigentes?), si el dueño puede ver quién accedió a la ficha de su mascota.

### p-07 · Auditoría de accesos de red — Decide: Legal
- No se registra qué usuario de la clínica receptora abrió una ficha compartida. ¿Debe la clínica de origen (y el dueño) poder consultarlo? ¿Retención?

### p-10 · Matriz de permisos: protecciones y asimetrías — Decide: Negocio
- Se puede quitar `usuarios.administrar` al rol Admin y dejar la clínica sin administración (`togglePermission`). Propuesta: bloquearlo.
- Veterinario aprueba pero no revoca accesos de red (solo Admin tiene `red.revocar`). ¿Intencional?
- ¿Los roles son fijos (4) o la clínica puede crear roles? ¿Permisos por usuario además de por rol?

## B. Dinero y documentos tributarios

### p-11 · Pagos y cobranza — Decide: Negocio + Dev
- `InvoiceStatus = Pagada` existe pero no hay operación de pago. `Owner.balance` no se modifica nunca.
- POS registra `PaymentMethod` sin pasarela, sin voucher, sin cierre/arqueo de caja (existe el evento de seguridad "Caja abierta sin venta").
- Definir: registrar pagos (parciales, medios, abonos a saldo), integración con terminal de pago/pasarela, devoluciones, cuotas (semilla: "pago en 3 cuotas").

### p-12 · Facturación electrónica SII (DTE) y folios — Decide: Legal + Dev
- Ni la factura (`Invoice`) ni la boleta (`Sale`) son DTE: no hay CAF/folios autorizados, timbre, envío al SII, datos del receptor (RUT empresa, razón social, giro), PDF ni envío al cliente.
- Folios hoy = max + 1 por clínica (`mock/db.ts:nextNumber`).
- Definir proveedor de facturación electrónica, tipos de documento (factura afecta 33, boleta 39, nota de crédito 61, guía de despacho 52), anulaciones, y si VetData factura por cuenta de la clínica.

### p-16 · Precios, descuentos y listas de precios — Decide: Negocio
- No hay descuentos, convenios, precios por cliente, promociones ni redondeos de efectivo. Los precios los envía el cliente (deben tomarse del catálogo).

### p-17 · ¿`Medication.price` es neto o con IVA? — Decide: Negocio
- En la factura se usa como neto y se le suma IVA (`invoice-form.tsx`); en OC se usa para estimar costo (`COST_RATIO`). Los productos de tienda son con IVA. Unificar criterio.

## C. Clínico y farmacia

### p-13 · Recetas, derivaciones externas y firma electrónica — Decide: Legal + Negocio
- `ReferralStatus = Recibida` no tiene operación; no está definido cómo la clínica destino recibe una derivación (no hay bandeja de "derivaciones recibidas").
- `Prescription` (historial) y `Referral` (farmacia) no están vinculadas.
- No hay firma electrónica del prescriptor, receta retenida, control de medicamentos sujetos a control (psicotrópicos/estupefacientes de uso veterinario, `Medication.prescription` es solo un booleano), ni verificación de receta al dispensar o al facturar medicamentos con `prescription = true`.

### p-22 · Escritura de la ficha clínica — Decide: Negocio + Dev
- Existe `ficha.editar` pero **no hay operaciones** para crear/editar mascotas, dueños, consultas, diagnósticos, vacunas, exámenes ni recetas.
- `PatientStatus` (`Al día`/`Control`/`Urgente`) no tiene regla de cálculo ni operación.
- Diagnóstico es texto libre clasificado por regex (`lib/analytics.ts:diagnosisCategory`). ¿Catálogo/códigos de diagnóstico (VeNom, SNOMED-CT vet)?

### p-24 · Lotes, vencimientos y recepción parcial — Decide: Negocio
- Un solo `lot`/`expiry` por medicamento. Recibir una OC no registra lote ni vencimiento. No hay recepción parcial ni diferencia de cantidades.
- Costo de compra = 55 % del precio (`COST_RATIO`): reemplazar por costo real del proveedor.

## D. Operación de la clínica

### p-15 · Zona horaria y horario de atención — Decide: Dev + Negocio
- Fecha/hora fijas `TODAY = 2026-10-07`, `NOW_TIME = 11:05` (`src/lib/format.ts`).
- Horas sin fecha ni zona (`Room.since`, `arrivedAt`, `AccessEntry.time`, `Sale.time`) y fecha-hora sin offset (`Ticket.createdAt`, `SecurityEvent.at`).
- Agenda fija 09:00–18:30 en bloques de 30 min (`SLOTS`) vs perfil "Lun a Sáb 09:00–20:00 · Urgencias 24 h" (texto). Definir horario estructurado por clínica y por profesional, feriados, duración variable de citas, sobrecupos, urgencias sin cita.
- Zona: `America/Santiago` (¿clínicas en Magallanes/Isla de Pascua?).

### p-23 · Pendientes: ¿cálculo en cliente o en servidor? — Decide: Dev
- Hoy la bandeja se deriva en el navegador desde todos los módulos (`lib/tasks.ts:useTasks`), lo que obliga a descargar todo. Propuesta: `GET /tasks` calculado en servidor con los mismos `taskId`.

### p-25 · Desactivar usuarios con agenda — Decide: Negocio
- ¿Qué pasa con las citas futuras de un veterinario desactivado? ¿Se reasignan, se cancelan, se bloquea la desactivación?
- `inviteUser` no crea `doctorId`: un veterinario nuevo no aparece en la agenda (hallazgo).

### p-26 · Gestión de eventos de seguridad — Decide: Negocio
- ¿Quién puede marcar `Falsa alarma` o `Resuelto` (¿`seguridad.ver` o `seguridad.administrar`)? ¿Se puede reabrir un evento cerrado? (la UI lo permite y no limpia `resolvedAt`).

## E. Integraciones simuladas

### p-08 · Envío real de WhatsApp, SMS y email — Decide: Negocio + Dev
- `tasks.sendReminder` solo marca al paciente; no envía. No hay confirmación de citas, envío de facturas/boletas, invitaciones, avisos de despacho, OC a proveedores.
- Definir proveedor (WhatsApp Business API, SMS, email transaccional), plantillas aprobadas, opt-in/opt-out del dueño (`preferredContact`), registro de entregas, costos por mensaje.

### p-09 · Video real, NVR, dispositivos y alarma — Decide: Dev + Negocio
- No hay video: cámaras dibujan escenas (`Camera.scene`). Grabaciones, clips, cerraduras, sensores, alarma y NVR son estados simulados.
- Definir: proveedor VMS/NVR (ONVIF/RTSP), cómo el backend firma URLs de stream y segmentos, exportación de clips (formato, marca de agua, hash), ingesta de eventos de dispositivos (puerta forzada, pánico, humo, movimiento, sin señal), central de alarmas, latencia.
- Privacidad de grabaciones: ¿ver una grabación de un box mientras estaba ocupado exige motivo como en vivo? ¿`Vio en vivo` se audita para todas las zonas o solo boxes?
- Audio en boxes/quirófano (`Camera.audio = true` en quirófano): implicancias legales.

### p-18 · Backoffice de VetData y SLA — Decide: Negocio
- `simulateSupportReply` y "Ver como" son **solo demo** (`support-store.tsx`, `topbar.tsx`). Se requiere un backoffice (otra aplicación/rol) para responder tickets, mover estados, gestionar ideas, releases y el alta de clínicas en la red.
- SLA en horas corridas (`SLA_HOURS`): ¿horario hábil? ¿por plan contratado?

### p-20 · Adjuntos — Decide: Negocio
- No hay archivos: exámenes (PDF/imágenes), radiografías, consentimientos firmados, capturas en tickets, documentos tributarios. Definir almacenamiento, límites, antivirus y control de acceso (mismas reglas de red/alcance).

## F. Datos, privacidad y analítica

### p-14 · Datos personales, retención y borrado — Decide: Legal
- Datos personales de dueños (RUT, contacto, dirección, nacimiento), usuarios, video con personas, accesos al hall.
- Definir conforme a la Ley 19.628 y su reforma (Ley 21.719): base de licitud, derechos ARCO/portabilidad del dueño, retención de fichas clínicas, borrado/anonimización, encargados de tratamiento (VetData como encargado de cada clínica), transferencia entre clínicas de la red, registro de actividades.

### p-19 · Retención de auditoría — Decide: Legal
- Retención de `AuditEntry` y auditoría administrativa/red (independiente de `retentionDays` del video). ¿Exportable? ¿Inmutable (WORM)?

### p-21 · Cálculo de métricas de red — Decide: Negocio + Dev
- Las series de red son dummy (`src/mocks/metrics.ts`) y la cobertura de red se calcula en el navegador sobre todas las fichas (`lib/metrics/clinic.ts:vaccineKpis`).
- Definir: frecuencia de cálculo (diario/mensual), qué clínicas participan (¿opt-in?), umbral mínimo de conteo para publicar (k-anonimato), "promedio por clínica" vs total, base del sector en alertas (sector de la clínica o del dueño), definición exacta de `coverageByVaccine`, texto editorial de `NetworkAlert.note` (¿quién lo escribe?).

## G. Parámetros fijados por el prototipo (confirmar o parametrizar)

| Parámetro | Valor | Fuente |
|---|---|---|
| IVA | 19 % (dos constantes) | `domain/services.ts:IVA_RATE`, `domain/retail.ts:IVA` |
| Costo estimado de compra | 55 % del precio de venta | `domain/pharmacy.ts:COST_RATIO` |
| Margen de servicios | 65 % | `domain/metrics.ts:SERVICES_MARGIN` |
| Aviso de vencimiento de medicamentos | 60 días | `domain/medications.ts:EXPIRY_WARNING_DAYS` |
| Vacuna "próxima" | ≤ 30 días | `lib/analytics.ts:vaccineState` |
| SLA primera respuesta | 4 / 24 / 72 / 168 h | `domain/support.ts:SLA_HOURS` |
| SLA "en riesgo" | < 25 % del plazo | `domain/support.ts:slaState` |
| Despacho gratis | solo comuna "Providencia" | `domain/retail.ts:deliveryFee` |
| Tarifa de despacho | $3.990 con IVA | `domain/retail.ts:deliveryFee` |
| Despacho programado | día siguiente | `mock/retail.ts:checkout` |
| Couriers | Reparto propio, Pedidos Ya Envíos, Chilexpress | `domain/retail.ts:COURIERS` |
| Aforo sala de espera | 12 personas | `domain/security.ts:WAITING_CAPACITY` |
| Retención de video | 15 / 30 / 60 / 90 días | `domain/security.ts:SecuritySettings` |
| Vigencias de acceso | 30 / 90 días / permanente | `domain/sharing.ts:DURATIONS` |
| Bloques de agenda | 30 min, 09:00–18:30 | `domain/appointments.ts:SLOTS` |
| "Llegada en box" | ≤ 60 min antes de la hora | `lib/metrics/day.ts:appointmentStage` |
| Paciente activo / nuevo | visita ≤ 365 días / primera consulta ≤ 90 días | `lib/metrics/customers.ts:patientKpis` |
| Ventana de rotación | farmacia 30 días, tienda 14 días | `lib/metrics/pharmacy.ts`, `lib/metrics/retail.ts` |
| Reposición sugerida | 2 × mínimo − stock | `pharmacy/purchasing.tsx:suggestedQty`, `retail/warehouse.tsx:refillQty` |

## H. Otros comportamientos solo de demo
- **"Ver como"** (cambiar de rol en el topbar): no debe existir en producción (`store.tsx:setRole`, `demoUserByRole`).
- **`simulateSupportReply`**: respuesta falsa de VetData (`support-store.tsx`).
- **Usuario del mock** fijo (`mock/db.ts:actor` = veterinario demo) aunque la UI "vea como" otro rol: los `user/seller/createdBy` del mock no coinciden con los optimistas.
- **Reconciliación de ids optimistas** pendiente (`services/index.ts:runInBackground` TODO): definir `Idempotency-Key` y manejo de errores/rollback en la UI.
- **Series de analítica fijas** no coherentes con los datos operativos.
