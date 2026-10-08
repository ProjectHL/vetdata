-- Seeds Fase 1: datos semilla desde frontend/src/mocks/.
-- Se aplican después de 002_fase1_core.sql sobre la base limpia.
-- UUIDs fijos (ver seeds_uuid_mapping.md) para trazabilidad entre mocks y DB.

------------------------------------------------------------------------
-- Group (1:1 con la clinica semilla Providencia, p-02)
------------------------------------------------------------------------
INSERT INTO groups (id, name) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'Grupo Providencia')
ON CONFLICT DO NOTHING;

------------------------------------------------------------------------
-- Clinica semilla: Clínica Veterinaria Providencia (networkClinics[0])
-- Usa clinicId estable (transversales.md §1.3). Los restantes networkClinics
-- son datos de red (catalogo) — se insertan como clinicas conectadas sin
-- perfil/sharing_policy completos, para validar multi-tenant.
------------------------------------------------------------------------
INSERT INTO clinics (id, group_id, name, sector, address, phone, email, specialties, status, joined_at, last_sync, patients_ref) VALUES
    ('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001',
     'Clínica Veterinaria Providencia', 'Providencia', 'Av. Providencia 1650',
     '+56 2 2233 4455', 'contacto@vetprovidencia.cl',
     ARRAY['Medicina general','Dermatología','Medicina felina'],
     'Conectada', '2024-03-01', '2026-10-07T11:02:00-03:00', 1840),

    ('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001',
     'Hospital Veterinario Ñuñoa', 'Ñuñoa', 'Irarrázaval 2890',
     '+56 2 2274 9900', 'hola@hvnunoa.cl',
     ARRAY['Urgencias 24 h','Cirugía','Odontología'],
     'Conectada', '2024-03-01', '2026-10-07T10:58:00-03:00', 3120),

    ('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001',
     'VetCare Las Condes', 'Las Condes', 'Apoquindo 5400',
     '+56 2 2945 1200', 'atencion@vetcare.cl',
     ARRAY['Cirugía','Traumatología','Exóticos'],
     'Conectada', '2024-06-15', '2026-10-07T11:04:00-03:00', 2275),

    ('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440001',
     'Centro Animal Maipú', 'Maipú', 'Av. Pajaritos 3100',
     '+56 2 2531 7788', 'contacto@centroanimal.cl',
     ARRAY['Medicina general','Cardiología','Imagenología'],
     'Conectada', '2024-09-10', '2026-10-07T10:47:00-03:00', 1960),

    ('660e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440001',
     'Clínica Veterinaria Vitacura', 'Vitacura', 'Av. Vitacura 6780',
     '+56 2 2218 3300', 'info@vetvitacura.cl',
     ARRAY['Oncología','Medicina felina'],
     'Conectada', '2025-02-20', '2026-10-07T09:15:00-03:00', 1180),

    ('660e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440001',
     'VetSur La Florida', 'La Florida', 'Vicuña Mackenna 7255',
     '+56 2 2281 6600', 'contacto@vetsur.cl',
     ARRAY['Medicina general','Vacunatorio'],
     'Conectada', '2025-07-01', '2026-10-06T19:40:00-03:00', 2410),

    ('660e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440001',
     'Hospital Veterinario Puente Alto', 'Puente Alto', 'Concha y Toro 1450',
     '+56 2 2850 4400', 'hvpa@hvpa.cl',
     ARRAY['Urgencias 24 h','Hospitalización'],
     'Conectada', '2026-01-12', '2026-10-07T08:30:00-03:00', 2890),

    ('660e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440001',
     'Clínica Costa Viña', 'Viña del Mar', 'Av. Libertad 1100',
     '+56 32 268 1100', 'contacto@costavina.cl',
     ARRAY['Medicina general','Fisioterapia'],
     'Invitación pendiente', '2026-09-30', NULL, 0)
ON CONFLICT DO NOTHING;

------------------------------------------------------------------------
-- Clinic profile semilla: ClinicProfile de Providencia (seedClinicProfile)
-- RUT normalizado sin puntos (§6): "76.543.210-3" → "76543210-3"
------------------------------------------------------------------------
INSERT INTO clinic_profiles (clinic_id, legal_name, rut, hours, boxes) VALUES
    ('660e8400-e29b-41d4-a716-446655440002',
     'Clínica Veterinaria Providencia SpA',
     '76543210-3',
     'Lun a Sáb 09:00–20:00 · Urgencias 24 h',
     6)
ON CONFLICT DO NOTHING;

------------------------------------------------------------------------
-- Sharing policy semilla: SharingPolicy de Providencia (seedSharingPolicy)
------------------------------------------------------------------------
INSERT INTO sharing_policies (clinic_id, default_scope, default_duration, require_consent, notify_requests) VALUES
    ('660e8400-e29b-41d4-a716-446655440002', 'Resumen clínico', 90, TRUE, TRUE)
ON CONFLICT DO NOTHING;

------------------------------------------------------------------------
-- Users semilla: seedUsers u1..u11 (settings.ts)
-- password_hash NULL (auth Fase 2, p-01). Último acceso simulado como timestamp.
------------------------------------------------------------------------
INSERT INTO users (id, name, email, password_hash, status, last_access) VALUES
    ('770e8400-e29b-41d4-a716-446655440001', 'Dra. Paula Rivas',      'privas@vetprovidencia.cl',      NULL, 'Activo',   '2026-10-07T11:04:00-03:00'),
    ('770e8400-e29b-41d4-a716-446655440002', 'Dr. Tomás Herrera',     'therrera@vetprovidencia.cl',    NULL, 'Activo',   '2026-10-07T09:28:00-03:00'),
    ('770e8400-e29b-41d4-a716-446655440003', 'Dra. Javiera Lagos',    'jlagos@vetprovidencia.cl',      NULL, 'Activo',   '2026-10-07T10:15:00-03:00'),
    ('770e8400-e29b-41d4-a716-446655440004', 'Dr. Andrés Molina',     'amolina@vetprovidencia.cl',     NULL, 'Activo',   '2026-10-06T18:40:00-03:00'),
    ('770e8400-e29b-41d4-a716-446655440005', 'Dra. Catalina Vera',    'cvera@vetprovidencia.cl',       NULL, 'Activo',   '2026-10-07T10:31:00-03:00'),
    ('770e8400-e29b-41d4-a716-446655440006', 'Dr. Ignacio Paredes',   'iparedes@vetprovidencia.cl',    NULL, 'Activo',   '2026-10-07T10:47:00-03:00'),
    ('770e8400-e29b-41d4-a716-446655440007', 'Constanza Arias',     'recepcion@vetprovidencia.cl',   NULL, 'Activo',   '2026-10-07T08:55:00-03:00'),
    ('770e8400-e29b-41d4-a716-446655440008', 'Bastián Lillo',         'blillo@vetprovidencia.cl',      NULL, 'Activo',   '2026-10-06T19:02:00-03:00'),
    ('770e8400-e29b-41d4-a716-446655440009', 'Marcela Toro',          'farmacia@vetprovidencia.cl',    NULL, 'Activo',   '2026-10-07T10:20:00-03:00'),
    ('770e8400-e29b-41d4-a716-446655440010', 'Rodrigo Bravo',         'admin@vetprovidencia.cl',       NULL, 'Activo',   '2026-10-05T16:12:00-03:00'),
    ('770e8400-e29b-41d4-a716-446655440011', 'Dra. Fernanda Gálvez',  'fgalvez@vetprovidencia.cl',     NULL, 'Invitado', NULL)
ON CONFLICT DO NOTHING;

------------------------------------------------------------------------
-- Memberships semilla: todos los usuarios pertenecen a Providencia.
-- Roles según seedUsers (settings.ts).
------------------------------------------------------------------------
INSERT INTO memberships (user_id, clinic_id, role) VALUES
    ('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440002', 'Veterinario'),
    ('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', 'Veterinario'),
    ('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440002', 'Veterinario'),
    ('770e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440002', 'Veterinario'),
    ('770e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440002', 'Veterinario'),
    ('770e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440002', 'Veterinario'),
    ('770e8400-e29b-41d4-a716-446655440007', '660e8400-e29b-41d4-a716-446655440002', 'Recepción'),
    ('770e8400-e29b-41d4-a716-446655440008', '660e8400-e29b-41d4-a716-446655440002', 'Recepción'),
    ('770e8400-e29b-41d4-a716-446655440009', '660e8400-e29b-41d4-a716-446655440002', 'Farmacia'),
    ('770e8400-e29b-41d4-a716-446655440010', '660e8400-e29b-41d4-a716-446655440002', 'Admin'),
    ('770e8400-e29b-41d4-a716-446655440011', '660e8400-e29b-41d4-a716-446655440002', 'Veterinario')
ON CONFLICT DO NOTHING;

------------------------------------------------------------------------
-- Doctors semilla: doctors d1..d6 (clinic.ts). user_id link vet-doctor.
-- d1→u1, d2→u2, ..., d6→u6 (fix p-25: crear vet genera doctor con user_id).
-- u11 (Fernanda Gálvez, Invitado) no tiene doctor linkado (no conectado).
------------------------------------------------------------------------
INSERT INTO doctors (id, clinic_id, user_id, name, specialty, initials) VALUES
    ('880e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440001', 'Dra. Paula Rivas',      'Medicina general',   'PR'),
    ('880e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440002', 'Dr. Tomás Herrera',     'Cirugía',            'TH'),
    ('880e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440003', 'Dra. Javiera Lagos',    'Dermatología',       'JL'),
    ('880e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440004', 'Dr. Andrés Molina',     'Traumatología',      'AM'),
    ('880e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440005', 'Dra. Catalina Vera',    'Imagenología',       'CV'),
    ('880e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440006', 'Dr. Ignacio Paredes',   'Medicina felina',    'IP')
ON CONFLICT DO NOTHING;

------------------------------------------------------------------------
-- Owners semilla: subset representativo de owners.ts (4 de 12).
-- RUT normalizado sin puntos (§6). balance en CLP enteros netos (p-17).
-- Emergency contact como JSONB. consent_metadata NULL (Fase 2 owner-driven,
-- shareConsent ya viene del dueño por email-token en Fase 2).
------------------------------------------------------------------------
INSERT INTO owners (id, rut, first_name, last_name, email, phone, alt_phone, address, sector, region, birth_date, registered_at, preferred_contact, emergency_contact, share_consent, consent_metadata, balance, notes) VALUES
    ('990e8400-e29b-41d4-a716-446655440001', '16482335-0', 'Camila',    'Rojas Fuenzalida',   'camila.rojas@gmail.com',            '+56 9 8123 4567', NULL,                         'Av. Providencia 2133, depto 504', 'Providencia', 'Región Metropolitana', '1987-04-12', '2021-03-08', 'WhatsApp', '{"name":"Rodrigo Rojas","phone":"+56 9 8123 0001"}', TRUE,  NULL, 0, NULL),
    ('990e8400-e29b-41d4-a716-446655440002', '13907452-1', 'Diego',     'Fuentes Araya',      'dfuentes@outlook.com',              '+56 9 7231 0098', '+56 2 2274 1180',           'Irarrázaval 3450',                'Ñuñoa',       'Región Metropolitana', '1979-09-30', '2020-11-19', 'Teléfono', '{"name":"Paula Araya","phone":"+56 9 7231 5520"}', TRUE,  NULL, 38500, 'Paciente renal en control trimestral.'),
    ('990e8400-e29b-41d4-a716-446655440003', '19234871-4', 'Valentina', 'Soto Ibáñez',        'vale.soto@gmail.com',               '+56 9 6612 3345', NULL,                         'Los Militares 5620, of. 1201',      'Las Condes',  'Región Metropolitana', '1996-01-22', '2024-02-14', 'WhatsApp', '{"name":"Jorge Soto","phone":"+56 9 6612 9988"}', TRUE,  NULL, 412000, 'Cirugía braquicefálica en curso; pago en 3 cuotas.'),
    ('990e8400-e29b-41d4-a716-446655440004', '18556013-9', 'Benjamín',  'Reyes Moya',         'benja.reyes@gmail.com',             '+56 9 2210 6754', NULL,                         'Manuel Montt 1520',               'Providencia', 'Región Metropolitana', '1993-11-27', '2026-09-29', 'WhatsApp', '{"name":"Carla Moya","phone":"+56 9 2210 3390"}', FALSE, NULL, 56800, NULL)
ON CONFLICT DO NOTHING;

------------------------------------------------------------------------
-- role_permissions semilla: matriz defaultRolePermissions para Providencia.
-- Admin = 21 permisos; Veterinario/Recepción/Farmacia según settings.ts.
------------------------------------------------------------------------
-- Admin: todos los permisos
INSERT INTO role_permissions (clinic_id, role, permission) VALUES
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'ficha.ver'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'ficha.editar'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'agenda.gestionar'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'facturas.emitir'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'medicamentos.derivar'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'farmacia.dispensar'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'farmacia.inventario'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'red.solicitar'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'red.aprobar'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'red.revocar'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'tienda.vender'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'tienda.inventario'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'tienda.compras'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'soporte.crear'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'soporte.administrar'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'seguridad.ver'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'seguridad.boxes'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'seguridad.grabaciones'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'seguridad.administrar'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'reportes.financiero'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Admin', 'usuarios.administrar');

-- Veterinario: 8 permisos
INSERT INTO role_permissions (clinic_id, role, permission) VALUES
    ('660e8400-e29b-41d4-a716-446655440002', 'Veterinario', 'ficha.ver'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Veterinario', 'ficha.editar'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Veterinario', 'agenda.gestionar'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Veterinario', 'facturas.emitir'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Veterinario', 'medicamentos.derivar'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Veterinario', 'red.solicitar'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Veterinario', 'red.aprobar'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Veterinario', 'soporte.crear');

-- Recepción: 6 permisos
INSERT INTO role_permissions (clinic_id, role, permission) VALUES
    ('660e8400-e29b-41d4-a716-446655440002', 'Recepción', 'agenda.gestionar'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Recepción', 'facturas.emitir'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Recepción', 'red.solicitar'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Recepción', 'tienda.vender'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Recepción', 'soporte.crear'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Recepción', 'seguridad.ver');

-- Farmacia: 8 permisos
INSERT INTO role_permissions (clinic_id, role, permission) VALUES
    ('660e8400-e29b-41d4-a716-446655440002', 'Farmacia', 'farmacia.dispensar'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Farmacia', 'farmacia.inventario'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Farmacia', 'facturas.emitir'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Farmacia', 'tienda.vender'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Farmacia', 'tienda.inventario'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Farmacia', 'tienda.compras'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Farmacia', 'soporte.crear'),
    ('660e8400-e29b-41d4-a716-446655440002', 'Farmacia', 'seguridad.ver');
