# Red y acceso: contrato objetivo del backend

[Decisiones](../../DECISIONES.md) · [Fase 2](../../roadmap/fase-02.md) · [API](../api.md)

## Autoridad y estado

Reglas vigentes: p-03 a p-07 y p-10 de DECISIONES.md. Este documento sustituye el flujo de aprobación por clínica del prototipo. Describe el contrato a implementar, no endpoints ya disponibles. Las rutas nuevas son la propuesta técnica para revisión del desarrollador.

El código frontend, sus mocks y el modelo/seed Go todavía contienen `sharing.respond`, `sharing.revoke`, `red.aprobar` y `red.revocar`. Deben migrarse en fases 2/5; no constituyen autorización válida en la API real.

## Propósito y reglas

1. La clínica de origen custodia la ficha; **el dueño autoriza** compartirla con una clínica solicitante, por mascota, alcance y vigencia.
2. La consulta pertenece a la clínica que la creó. Perder acceso a clínico ajeno no elimina citas, facturas ni registros propios de la receptora.
3. La clínica activa y el usuario solicitante salen de la sesión. Relaciones por clinicId; nombres solo para presentación.
4. Sin acceso, la búsqueda de red devuelve mascota (nombre, especie, raza, origen) y dueño (nombre, sector), sin contacto. RUT de búsqueda debe validarse; no es credencial de autenticación.
5. Solo un grant vigente autoriza lectura compartida. Aplicar la misma regla en listas, detalle, búsqueda, tareas, agenda, boxes, analítica y adjuntos.
6. Resumen clínico incluye identificación, alergias, condiciones crónicas y vacunas; excluye consultas, exámenes y recetas en la respuesta del servidor.
7. Solicitudes propias, duplicadas pendientes o con grant vigente generan 409; renovación vinculada se diseña como operación explícita con su propio contrato.
8. Una suspensión no permite eludir el freno mediante una solicitud/grant alternativo. La renovación no restablece consentimientos revocados ni suspensiones.
9. Una política de clínica nunca omite el consentimiento del dueño ni amplía el alcance autorizado.

## Entidades y relaciones

| Entidad | Campos mínimos del contrato objetivo | Restricciones |
|---|---|---|
| Clinic | id, name, datos de directorio | UUID estable; nombre no es clave. |
| Owner | id, rut normalizado, contacto verificado | Global por RUT; vínculo por clínica y datos operativos aislados. |
| AccessRequest | id, patientId, requestingClinicId, originClinicId, requestedBy, reason, requestedScope, requestedDuration, status, createdAt, expiresAt, respondedAt, previousRequestId opcional | Actor/origen desde servidor; una pendiente por mascota/receptora; expiresAt a 72 h del inicio del flujo de autorización. |
| OwnerAuthorizationToken | hash, requestId o recurso/acción autorizados, expiresAt, usedAt | Secreto de un uso; no retornar hash a clientes ni guardar token en logs. |
| ConsentEvidence | id, ownerId, requestId, grantId, scope, duration, confirmedAt, ip, method | Método email-link; evidencia inmutable ligada al dueño y autorización concreta. |
| AccessGrant | id, requestId, consentId, patientId, originClinicId, grantedToClinicId, scope, since, until, revokedAt, suspension | since/until civiles; until inclusive; null permanente; estado derivado. |
| Suspension | grantId, reason, actorId, suspendedAt, restoredAt, restoredBy | Admin de origen, motivo obligatorio, cambios auditados y notificados. |
| SharedReadAudit | patientId, grantId, readerUserId, readerClinicId, scope, at | Insertar antes de devolver datos; acceso para origen y dueño verificado. |
| SharingPolicy | defaultScope, defaultDuration, preferencias de notificación | Defaults de solicitud; requireConsent del prototipo no habilita excepciones. |

Los campos exactos y DTO se fijan en OpenAPI antes de T2-4. Token de decisión consumido no sirve para auditoría/revocación posterior: esos flujos exigen una nueva autorización temporal del dueño, limitada a su propósito.

## Estados y operaciones

Solicitud: `Esperando dueño → Aprobada | Denegada | Expirada | Cancelada`. Terminales no aceptan otra respuesta. Cancelada la ejecuta la solicitante; Expirada se deriva/aplica al superar 72 h, incluso si el job todavía no corrió.

Grant: `Revocado > Vencido > Suspendido > Vigente`. Esta precedencia es la propuesta de presentación; cualquiera de los tres primeros impide compartir. Hasta el final del día until en America/Santiago es vigente si no existe revocación/suspensión. Restablecer quita suspensión, sin alterar vigencia ni revocación.

Aprobar consume token y registra evidencia, solicitud y grant en una sola transacción. Denegar también consume token. El dueño puede reducir alcance, nunca ampliarlo. La vigencia otorgada no excede la solicitada. Correo fallido no concede acceso.

## Endpoints propuestos

Prefijo /api/v1. Las rutas de dueño reciben credencial limitada en cuerpo o sesión temporal verificada; no utilizan sesión de clínica como sustituto de la identidad del dueño.

| Operación objetivo | Método y ruta | Entrada / salida | Autorización y errores |
|---|---|---|---|
| network.listClinics | GET /network/clinics | Filtros → directorio paginado | Sesión, aislamiento según campos expuestos. |
| network.search | GET /network/search | RUT validado → tarjetas mínimas | Sesión; rate limit y registro; 400 si RUT inválido. |
| sharing.listRequests | GET /sharing/requests | Filtros → solicitudes de mi clínica, como solicitante u origen | Sesión y campos autorizados; origen recibe información, no poder de aprobación. |
| sharing.listGrants | GET /sharing/grants | Filtros → grants con estado derivado | Sesión; solo relación autorizada. |
| sharing.sendRequests | POST /sharing/requests | patientIds, scope, duration, reason → solicitudes | red.solicitar; 409 propia/duplicada/acceso vigente. Cada solicitud se autoriza por separado. |
| sharing.cancelRequest | POST /sharing/requests/:id/cancel | → solicitud cancelada | Solicitante con red.solicitar; 409 si terminal. Invalida token. |
| sharing.resendRequest | POST /sharing/requests/:id/resend | → estado de entrega | Solicitante con red.solicitar; límites y reemplazo seguro de token; no extensión silenciosa de las 72 h. |
| sharing.renewRequest | POST /sharing/requests/:id/renew | scope, duration, reason → nueva solicitud vinculada | Solicitante; nuevo consentimiento obligatorio. Definir activación sin grants superpuestos antes de implementar. |
| owner.decideRequest | POST /owner/sharing/requests/:id/decision | credencial, rut, decisión, alcance → request y grant opcional | Dueño verificado; 400 RUT inválido, 409 estado/token consumido; alcance superior rechazado. |
| owner.revokeConsent | POST /owner/sharing/grants/:id/revoke | autorización temporal del dueño → grant revocado | Dueño verificado; invalida consentimiento/grant correspondiente y cachés. |
| sharing.suspendGrant | POST /sharing/grants/:id/suspend | reason → grant | Admin de origen + red.suspender; 403/409/422. |
| sharing.restoreGrant | POST /sharing/grants/:id/restore | reason → grant | Admin de origen + red.suspender; no renueva ni revive grant revocado. |
| sharing.listAudit | GET /sharing/audit | filtros → lecturas autorizadas | Clínica de origen; no datos de otras custodias. |
| owner.listAudit | GET /owner/sharing/audit | sesión temporal verificada → lecturas de sus mascotas | Dueño verificado; RUT conocido no basta. |

`GET /me/clinic` se consolida en `GET /me` con user, clinic y permissions. Las rutas antiguas de aprobación por clínica y revocación discrecional se retiran del contrato objetivo; no se implementan como alias que eludan la autorización del dueño.

## Eventos, atomicidad y retención

- AccesoSolicitado entrega correo al dueño con solicitante, mascota, alcance, vigencia y enlace de un uso.
- Aprobación/denegación informan al solicitante; el origen recibe notificación conforme a p-05.
- Suspensión/restablecimiento informan al dueño y receptora e incluyen auditoría del actor/motivo.
- Renovación es nueva solicitud vinculada; aviso siete días antes del vencimiento.
- Outbox y operación de dominio se confirman juntos. Reintentar correo no repite grants.
- Auditoría de lecturas: p-07 establece 2–3 años, exacto pendiente D-01. Auditoría administrativa: cinco años, p-19. Video: treinta días predeterminado. No habilitar purga de una categoría sin política aprobada.

## Fixtures y aceptación

Dos clínicas en grupos distintos, dueño verificado, usuario con memberships en ambas y cuatro roles. Casos con tarjeta mínima, resumen, completo, revocado, vencido y suspendido.

Probar doble consumo de token, expiración/cancelación, correo fallido, escalamiento de alcance, revocación durante lectura, aislamiento de auditoría, pérdida de acceso y conservación de documentos propios. Cierre conforme a [Fase 2](../../roadmap/fase-02.md) y registro en [validación](../../roadmap/validacion.md).
