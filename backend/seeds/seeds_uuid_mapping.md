# UUID Mapping: frontend mocks ↔ backend seeds

Fija UUIDs para trazabilidad cruzada entre `frontend/src/mocks/` y `backend/seeds/002_fase1_seeds.sql`.

## groups

| Mock       | UUID                                       |
|------------|--------------------------------------------|
| Grupo Providencia | `550e8400-e29b-41d4-a716-446655440001` |

## clinics (networkClinics[0..7])

| Mock                         | UUID                                       |
|------------------------------|--------------------------------------------|
| Clínica Veterinaria Providencia | `660e8400-e29b-41d4-a716-446655440002` (seed clinic) |
| Hospital Veterinario Ñuñoa      | `660e8400-e29b-41d4-a716-446655440003` |
| VetCare Las Condes              | `660e8400-e29b-41d4-a716-446655440004` |
| Centro Animal Maipú             | `660e8400-e29b-41d4-a716-446655440005` |
| Clínica Veterinaria Vitacura    | `660e8400-e29b-41d4-a716-446655440006` |
| VetSur La Florida               | `660e8400-e29b-41d4-a716-446655440007` |
| Hospital Veterinario Puente Alto | `660e8400-e29b-41d4-a716-446655440008` |
| Clínica Costa Viña              | `660e8400-e29b-41d4-a716-446655440009` |

## users (seedUsers u1..u11)

| Mock | Nombre                 | Email                          | UUID                                       |
|------|------------------------|--------------------------------|--------------------------------------------|
| u1   | Dra. Paula Rivas       | privas@vetprovidencia.cl       | `770e8400-e29b-41d4-a716-446655440001` |
| u2   | Dr. Tomás Herrera      | therrera@vetprovidencia.cl     | `770e8400-e29b-41d4-a716-446655440002` |
| u3   | Dra. Javiera Lagos     | jlagos@vetprovidencia.cl       | `770e8400-e29b-41d4-a716-446655440003` |
| u4   | Dr. Andrés Molina      | amolina@vetprovidencia.cl      | `770e8400-e29b-41d4-a716-446655440004` |
| u5   | Dra. Catalina Vera     | cvera@vetprovidencia.cl        | `770e8400-e29b-41d4-a716-446655440005` |
| u6   | Dr. Ignacio Paredes    | iparedes@vetprovidencia.cl     | `770e8400-e29b-41d4-a716-446655440006` |
| u7   | Constanza Arias        | recepcion@vetprovidencia.cl    | `770e8400-e29b-41d4-a716-446655440007` |
| u8   | Bastián Lillo          | blillo@vetprovidencia.cl       | `770e8400-e29b-41d4-a716-446655440008` |
| u9   | Marcela Toro           | farmacia@vetprovidencia.cl     | `770e8400-e29b-41d4-a716-446655440009` |
| u10  | Rodrigo Bravo          | admin@vetprovidencia.cl        | `770e8400-e29b-41d4-a716-446655440010` |
| u11  | Dra. Fernanda Gálvez   | fgalvez@vetprovidencia.cl      | `770e8400-e29b-41d4-a716-446655440011` |

## doctors (d1..d6, clinic.ts)

| Mock | Nombre               | Especialidad       | Initials | UUID                                       | user_id (→u) |
|------|----------------------|--------------------|----------|--------------------------------------------|--------------|
| d1   | Dra. Paula Rivas     | Medicina general   | PR       | `880e8400-e29b-41d4-a716-446655440001` | → u1 |
| d2   | Dr. Tomás Herrera    | Cirugía            | TH       | `880e8400-e29b-41d4-a716-446655440002` | → u2 |
| d3   | Dra. Javiera Lagos   | Dermatología       | JL       | `880e8400-e29b-41d4-a716-446655440003` | → u3 |
| d4   | Dr. Andrés Molina    | Traumatología      | AM       | `880e8400-e29b-41d4-a716-446655440004` | → u4 |
| d5   | Dra. Catalina Vera   | Imagenología       | CV       | `880e8400-e29b-41d4-a716-446655440005` | → u5 |
| d6   | Dr. Ignacio Paredes  | Medicina felina    | IP       | `880e8400-e29b-41d4-a716-446655440006` | → u6 |

## owners (owners.ts — subset de 4 de 12)

| Mock | RUT          | Nombre                | UUID                                       |
|------|--------------|-----------------------|--------------------------------------------|
| o1   | 16482335-0   | Camila Rojas Fuenzalida | `990e8400-e29b-41d4-a716-446655440001` |
| o2   | 13907452-1   | Diego Fuentes Araya   | `990e8400-e29b-41d4-a716-446655440002` |
| o3   | 19234871-4   | Valentina Soto Ibáñez | `990e8400-e29b-41d4-a716-446655440003` |
| o4   | 18556013-9   | Benjamín Reyes Moya   | `990e8400-e29b-41d4-a716-446655440004` |

> Los 8 owners restantes de `owners.ts` no se insertan en Fase 1 (se cargan bajo demanda). Ver nota en el archivo de seeds.

## role_permissions

- clinic_id: siempre `660e8400-...002` (Providencia)
- Matriz completa en `backend/internal/model/model.go:DefaultRolePermissions()` y en `002_fase1_seeds.sql`.
