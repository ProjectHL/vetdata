# Definiciones pendientes para revisión con el desarrollador

El usuario indicó conservar aquí las reglas sin respuesta y continuar con los paquetes independientes. No asumir aprobación de reglas de producto por completar el código.

| ID | Decisión | Pregunta pendiente | Implementación afectada | Tratamiento mientras se resuelve |
|---|---|---|---|---|
| D-02 | p-13 | ¿Qué puede consultar, aceptar y dispensar la clínica que recibe una derivación externa? | Bandeja externa y transición Recibida en T3-5 | No habilitar aceptación/dispensación externa; continuar farmacia interna. |
| D-03 | p-22 | ¿Qué condiciones y precedencia determinan Al día, Control y Urgente? | PatientStatus calculado, T3-2 | No inferir gravedad médica ni clasificar automáticamente. Estado pendiente de evaluación en contrato real. |
| D-01 | p-07/p-19 | Duración exacta de lecturas compartidas y evidencia de consentimiento | Purga automática T7-3 | Conservar registros; no ejecutar purga sin política validada. |
| D-04 | p-21 | Fórmulas/denominadores y cortes de las métricas comparativas | Agregados de red T4-4 | No publicar métricas sin fórmula aprobada; mantener controles de aislamiento y umbral. |

Proveedores, infraestructura, firmas/licencias y credenciales continúan según el registro D del [roadmap](README.md#decisiones-y-dependencias-diferidas). Documentar la respuesta, fecha y revisor antes de habilitar cada funcionalidad dependiente. Un cambio de p-NN requiere además el procedimiento de DECISIONES.md.
