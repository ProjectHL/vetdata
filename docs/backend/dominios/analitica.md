# Analítica (métricas derivadas y series de red)

> **Inventario del prototipo con cambios objetivo.** [DECISIONES.md](../../DECISIONES.md) prevalece sobre las reglas inferidas del mock. p-21: cálculo diario en servidor, k≥5, sector del dueño, default-on anónimo y opt-out; fórmulas/cortes pendientes D-04. No trasladar fichas ajenas al navegador para calcular agregados. Ver paquetes y evidencia en el [roadmap](../../roadmap/README.md).


> Fuentes: `src/domain/metrics.ts` (`SERVICES_MARGIN`, tipos de series) · `src/services/contracts.ts` (`AnalyticsService`) · `src/services/mock/analytics.ts` · `src/mocks/metrics.ts` (series dummy) · `src/lib/analytics.ts` · `src/lib/metrics/{clinic,customers,day,pharmacy,retail,support}.ts` · `src/components/analytics/*` · `src/components/dashboard/my-day/*`

## Propósito
Indicadores para la gestión de la clínica (operación, vacunación, diagnósticos, clientes, tienda, finanzas) y comparación con la **red** mediante agregados anónimos.

Pantallas: `/analisis/panorama`, `/analisis/vacunacion`, `/analisis/diagnosticos`, `/analisis/clientes`, `/analisis/tienda`, `/analisis/reportes`, `/dashboard` (Mi día por rol).

## Dos tipos de métricas
1. **Series históricas** servidas por `AnalyticsService` (8 operaciones). Hoy son **datos fijos** (`src/mocks/metrics.ts`, "dummy") de 12 meses (nov–oct). Incluyen columnas "red".
2. **KPIs derivados en el cliente** desde los datos de los stores (`src/lib/metrics/*`, `src/lib/analytics.ts`). No tienen endpoint: se calculan sobre listas completas que la UI descarga.

**Principio de red** *(regla)*: "Los datos de la red son agregados anónimos: conteos y porcentajes, nunca fichas ni datos de dueños" (`src/domain/metrics.ts`, cabecera). **Hallazgo**: `vaccineKpis().networkCoverage` y `vaccination.tsx` calculan la cobertura de red con `coverage(patients)` sobre **todas las fichas de la red** en el navegador (`src/lib/metrics/clinic.ts:vaccineKpis`). En producción el cliente no debe recibir esas fichas: la cobertura de red DEBE venir agregada del servidor.

## Entidades (series)
| Tipo | Campos | Significado |
|---|---|---|
| `MonthlyConsults` | `month, clinica, red` | Consultas por mes: mi clínica vs **promedio por clínica** de la red. |
| `MonthlyRevenue` | `month, ingresos` | Ingresos netos CLP de mi clínica. |
| `RevenueByLine` | `month, servicios, farmacia, tienda` | Ingresos netos por línea. |
| `VaccineCoverage` | `species, clinica, red` | % de pacientes al día por especie. |
| `CoverageByVaccine` | `vaccine, clinica, red` | % de cobertura por vacuna. |
| `DiagnosisCategory` | `category, clinica, redPct` | Casos en mi clínica y % del total de la red. |
| `NetworkAlert` | `sector, category, current, previous, note` | Casos últimos 30 días vs 30 previos por comuna y categoría (anónimo). `note` es texto editorial. |
| `BoxOccupancy` | `box, ocupacion` | % del horario ocupado por box. |

## Catálogo de métricas

### A. Series (`AnalyticsService`) — deben calcularse en backend
| Operación | Fórmula propuesta | Fuente de datos | ¿Agregado de red anónimo? | Consumidor |
|---|---|---|---|---|
| `analytics.monthlyConsults` | `clinica` = nº consultas registradas por mi clínica en el mes; `red` = total consultas de clínicas conectadas / nº clínicas conectadas ese mes | Consultas (no existe aún su escritura, `#p-22`) | `red`: **sí** | `analytics/diagnoses.tsx` (tendencia), `metrics/clinic.ts:consultsThisMonth` |
| `analytics.monthlyRevenue` | Σ neto facturas del mes + Σ neto boletas del mes (sin despacho) | `Invoice.net`, `Sale` | No (solo mi clínica) | `analytics/reports.tsx` (permiso `reportes.financiero`) |
| `analytics.revenueByLine` | `servicios` = Σ neto líneas de factura sin `medicationId`; `farmacia` = Σ neto líneas con `medicationId`; `tienda` = Σ `(total − deliveryFee)/1,19` de boletas | Facturas, boletas | No | `analytics/panorama.tsx` (reemplaza el mes en curso de tienda con `retailMonthNet`, mezclando serie fija y dato vivo — *supuesto del prototipo*) |
| `analytics.vaccineCoverage` | Por especie: `coverage(pacientes)` = % con ≥ 1 vacuna y ninguna vencida, sobre los que tienen registro de vacunas; `clinica` sobre pacientes visibles, `red` sobre todos los de la red | Vacunas | `red`: **sí** | `analytics/vaccination.tsx` |
| `analytics.coverageByVaccine` | Por vacuna: % de pacientes con esa vacuna no vencida sobre los que la tienen registrada (definición a confirmar, `#p-21`) | Vacunas | `red`: **sí** | `analytics/vaccination.tsx` |
| `analytics.diagnosisCategories` | `clinica` = nº consultas de mi clínica por categoría (`diagnosisCategory`); `redPct` = % de esa categoría sobre el total de diagnósticos de la red | Consultas | `redPct`: **sí** | `analytics/diagnoses.tsx` |
| `analytics.networkAlerts` | Por (sector, categoría): casos en 30 días vs 30 días previos en toda la red; publicar solo si supera umbral de casos y variación | Consultas + `Clinic.sector` (o sector del dueño) | **Sí** (k-anonimato, `#p-21`) | `analytics/diagnoses.tsx` |
| `analytics.boxOccupancy` | Por box: minutos en estado `ocupado` / minutos de horario de atención del período | **Historial de estados de `Room`** (no existe: hoy solo estado actual) | No | `analytics/reports.tsx` |

### B. KPIs hoy calculados en el cliente (decidir si migran a backend)
Recomendación general: mantener en cliente los que operan sobre listas ya paginadas/pequeñas del día; mover a backend los que requieren historia completa, datos de otras clínicas o datos financieros con permiso.

| KPI | Fórmula | Fuente (función) | ¿Backend? |
|---|---|---|---|
| Pacientes visibles | propios + compartidos vigentes | `lib/analytics.ts:visiblePatients` | Sí (es la regla de acceso) |
| Estado de vacuna / al día / cobertura | ver reglas en [pacientes](pacientes-y-propietarios.md) | `lib/analytics.ts:vaccineState, isUpToDate, coverage` | Cobertura de red: **sí**; local: opcional |
| Vacunas vencidas / próximas (≤ 30 d) | lista ordenada por días | `lib/analytics.ts:dueVaccines` | Recomendado (alimenta recordatorios) |
| Categoría de diagnóstico | regex sobre texto | `lib/analytics.ts:diagnosisCategory` | Sí (debe ser código estructurado) |
| Pacientes con categoría | | `lib/analytics.ts:patientsWithCategory` | Opcional |
| Consultas del mes vs mes anterior | últimos 2 puntos de `monthlyConsults` | `lib/metrics/clinic.ts:consultsThisMonth` | Usa serie del backend |
| KPIs de vacunación | coverage, networkCoverage, overdue, soon | `lib/metrics/clinic.ts:vaccineKpis` | `networkCoverage` **sí** |
| Tasas de citas | próximas (≥ hoy, activas); realizadas; % cancelación y % no asistió **sobre citas ya ocurridas** (Realizada+Cancelada+No asistió) | `lib/metrics/clinic.ts:appointmentRates` | Sí (requiere historia) |
| Carga de agenda 7 días | por profesional: citas activas / (20 bloques × 7 días); próxima hora libre | `lib/metrics/clinic.ts:agendaLoad` | Recomendado (`GET /doctors/availability`) |
| Pacientes activos / nuevos 90 d / retorno | activo = visita en últimos 365 días; nuevo = primera consulta en últimos 90 días; retorno = % con ≥ 2 consultas | `lib/metrics/customers.ts:patientKpis` | Sí |
| Distribución por especie | conteo y % | `customers.ts:speciesDistribution` | Opcional |
| Mascotas por dueño | buckets 1 / 2 / 3+ | `customers.ts:petsPerOwner` | Opcional |
| Gasto por cliente | Σ facturas (total) + Σ boletas (total) por RUT | `customers.ts:customerSpend` | Sí (`reportes.financiero`) |
| Omnicanalidad | % de dueños con consultas y compras en tienda | `customers.ts:omnichannel` | Sí |
| Por cobrar | facturas `Emitida` + `Owner.balance`, buckets 0–30/31–60/>60 días | `customers.ts:receivables` | Sí (`reportes.financiero`) |
| Facturado, por cobrar, ticket promedio, por servicio | Σ totales | `components/analytics/reports.tsx` | Sí. **Hallazgo**: "Por cobrar" en Reportes suma `balance` de **todos** los dueños (`owners.reduce`), incluidos los de otras clínicas, inconsistente con `receivables` (solo visibles). |
| Etapa de cita, llegadas esperadas | ver [agenda](agenda-y-atencion.md) | `lib/metrics/day.ts` | Recomendado |
| Farmacia: stock bajo, recetas por dispensar | | `lib/metrics/pharmacy.ts:pharmacyKpis` | Opcional |
| Rotación y cobertura de medicamentos | `out30` = salidas últimos 30 d; stock promedio = (stock + (stock + out30))/2; rotación = out30/promedio; cobertura días = stock / (out30/30) | `lib/metrics/pharmacy.ts:medicationTurnover` | Sí |
| Valor por vencer | Σ stock × costo estimado | `pharmacy.ts:expiringValue` | Sí |
| Valor inventario / mermas | Σ stock × round(price × 0,55); Σ ajustes × costo | `reports.tsx` | Sí (`COST_RATIO` supuesto) |
| Tienda hoy | total y nº de boletas de hoy; productos a reponer | `lib/metrics/retail.ts:retailKpis` | Opcional |
| Venta neta del mes tienda | Σ (total − despacho)/1,19 del mes | `retail.ts:retailMonthNet` | Sí |
| Desglose de ventas | por canal, por medio de pago, ticket promedio, % con RUT, recompra (% clientes con ≥ 2 boletas) | `retail.ts:salesBreakdown` | Sí |
| Margen por categoría | ingreso neto − Σ qty × cost actual | `retail.ts:marginByCategory` | Sí (`reportes.financiero`). Usa costo **actual**, no histórico → guardar costo en la venta |
| Rotación de productos (14 días) | vendido / stock promedio; cobertura = stock / (vendido/14) | `retail.ts:productTurnover` | Sí. **Hallazgo**: suma **todas** las ventas cargadas, no filtra los últimos 14 días |
| Despachos | por estado, por sector, atrasados, % a tiempo | `retail.ts:shipmentKpis` | Opcional; guardar `deliveredAt` |
| Venta cruzada por especie | top 3 categorías compradas por especie de las mascotas del cliente | `retail.ts:crossSellBySpecies` | Sí |
| Soporte | abiertos, en riesgo, críticos, prom. 1ª respuesta, CSAT | `lib/metrics/support.ts:supportKpis` | Opcional |
| Red (reportes) | solicitudes recibidas/enviadas, tasa de aprobación (sobre respondidas), tiempo medio de respuesta en días, accesos vigentes | `reports.tsx` | Sí |
| Margen estimado mensual | servicios × 0,65 + farmacia × (1 − 0,55) + tienda × margen % tienda | `analytics/panorama.tsx`, `SERVICES_MARGIN = 0.65`, `COST_RATIO = 0.55` | *(supuesto del prototipo)*; requiere costos reales |

## Reglas de negocio
1. **Universo "mi clínica"** = pacientes propios + compartidos vigentes. Fuente: `src/lib/analytics.ts:visiblePatients`. *(regla)*
2. **Agregados de red anónimos**: solo conteos/porcentajes; nunca fichas, dueños ni identificadores; aplicar umbral mínimo. Fuente: `src/domain/metrics.ts`. *(regla)*
3. **Promedio de red por clínica** (no suma) en consultas mensuales. Fuente: `domain/metrics.ts:MonthlyConsults` ("promedio por clínica de la red"). *(regla)*
4. **Margen supuesto de servicios 65 %**. Fuente: `src/domain/metrics.ts:SERVICES_MARGIN`. *(supuesto del prototipo)*.
5. **Datos financieros** visibles solo con `reportes.financiero`. Fuente: `analytics/reports.tsx`, `panorama.tsx`, `customers.tsx`, `retail-analytics.tsx` (`RequirePermission`). *(regla)* — el servidor no debe enviar montos a roles sin el permiso.

## Estados
Sin máquinas de estado propias (usa estados derivados de otros dominios).

## Operaciones y endpoints sugeridos
| Operación (servicio) | Método y ruta | Entrada | Salida | Permiso | Errores | Auditoría / efectos |
|---|---|---|---|---|---|---|
| `analytics.monthlyConsults` | `GET /api/v1/analytics/monthly-consults` | `?months=12` | `MonthlyConsults[]` | sesión | 401 | — |
| `analytics.monthlyRevenue` | `GET /api/v1/analytics/monthly-revenue` | `?months` | `MonthlyRevenue[]` | `reportes.financiero` | 403 | — |
| `analytics.revenueByLine` | `GET /api/v1/analytics/revenue-by-line` | `?months` | `RevenueByLine[]` | `reportes.financiero` | 403 | — |
| `analytics.vaccineCoverage` | `GET /api/v1/analytics/vaccine-coverage` | — | `VaccineCoverage[]` | sesión | 401 | — |
| `analytics.coverageByVaccine` | `GET /api/v1/analytics/coverage-by-vaccine` | — | `CoverageByVaccine[]` | sesión | 401 | — |
| `analytics.diagnosisCategories` | `GET /api/v1/analytics/diagnosis-categories` | `?months` | `DiagnosisCategory[]` | sesión | 401 | — |
| `analytics.networkAlerts` | `GET /api/v1/analytics/network-alerts` | — | `NetworkAlert[]` | sesión | 401 | Evento `AlertaRedPublicada` (opcional) |
| `analytics.boxOccupancy` | `GET /api/v1/analytics/box-occupancy` | `?from&to` | `BoxOccupancy[]` | sesión (propuesto `reportes.financiero` por estar en Reportes) | 401 | — |

## Efectos en otros dominios
Ninguno (solo lectura). Requiere que otros dominios guarden historia: estados de boxes con tiempo, costo histórico en ventas, `deliveredAt` de despachos, consultas con código de diagnóstico.

## Datos de referencia / semilla
Series dummy de `src/mocks/metrics.ts` (12 meses; octubre parcial). Palabras clave de categorías (`CATEGORY_KEYWORDS`).

## Notas para el dev
- Cálculo de métricas de red (cuándo, con qué latencia, umbrales, qué clínicas participan) → `preguntas-abiertas.md#p-21`.
- Las series fijas no son coherentes con los datos operativos (p. ej. ingresos de septiembre no salen de las facturas semilla).
