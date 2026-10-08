# Instalación local de Fase 1 — PowerShell y Docker

Ejecutar desde la raíz del repositorio. Docker Desktop debe estar iniciado en modo Linux. El frontend sigue en modo mock hasta Fase 5; la validación de esta entrega se hace mediante API.

## 1. Variables locales y buzón de desarrollo

Generar una clave aleatoria de outbox y conservarla en `.env` (ignorado por Git). Si ya existe ese archivo, conservar sus valores y añadir `OUTBOX_KEY` sin cambiar una clave existente. No rotarla mientras haya mensajes pendientes sin un procedimiento de migración.

Para una instalación nueva sin `.env`:

```powershell
if (Test-Path -LiteralPath .env) { throw 'Ya existe .env: conserva su contenido y clave' }
$outboxBytes = New-Object byte[] 32
$randomSource = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$randomSource.GetBytes($outboxBytes)
$randomSource.Dispose()
$outboxKey = [Convert]::ToBase64String($outboxBytes)
Set-Content -LiteralPath .env -Encoding ascii -Value "OUTBOX_KEY=$outboxKey"
Remove-Variable outboxKey, outboxBytes
```

El Compose adicional usa Mailpit sin relay externo. Buzón visible en `http://localhost:8025`. `PUBLIC_WEB_URL` debe coincidir exactamente con el origen usado en solicitudes; por defecto `http://localhost:3000`. La URL de API del navegador es `http://localhost:4000`.

## 2. Construir y preparar datos de desarrollo

```powershell
docker compose -f infra/docker-compose.yml -f infra/docker-compose.mail.yml build api
docker compose -f infra/docker-compose.yml -f infra/docker-compose.mail.yml up -d db mail
docker compose -f infra/docker-compose.yml -f infra/docker-compose.mail.yml run --rm --entrypoint /usr/local/bin/setup api --seed-dev
```

`setup` aplica primero todas las migraciones y luego seeds en una transacción. Es repetible. `--seed-dev` solo sirve para una base local de demostración; normaliza fixtures de IDs conocidos, no es un importador de datos reales y se rechaza con `APP_ENV=production`. Para una base existente sin fixtures, omitir `--seed-dev`: la API aplica únicamente migraciones pendientes al arrancar.

## 3. Crear administrador local

El correo siguiente es una cuenta de desarrollo nueva. La contraseña se lee sin mostrarla y se pasa por stdin; no va en argumentos de proceso ni en el repositorio. Entre 12 y 72 bytes. Repetir el bootstrap no cambia una contraseña establecida.

```powershell
$adminSecret = Read-Host 'Contraseña del administrador local' -AsSecureString
$adminPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminSecret)
try {
    $adminPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($adminPointer)
    $adminPassword | docker compose -f infra/docker-compose.yml -f infra/docker-compose.mail.yml run --rm -T --entrypoint /usr/local/bin/setup -e BOOTSTRAP_CLINIC_ID=660e8400-e29b-41d4-a716-446655440002 -e BOOTSTRAP_NAME=AdminLocal -e BOOTSTRAP_EMAIL=admin@example.test api --admin
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($adminPointer)
    Remove-Variable adminPassword -ErrorAction SilentlyContinue
    $adminSecret.Dispose()
}
```

## 4. Arrancar API y comprobar sesión

```powershell
docker compose -f infra/docker-compose.yml -f infra/docker-compose.mail.yml up -d api
Invoke-RestMethod http://localhost:4000/healthz
$loginSecret = Read-Host 'Contraseña de admin@example.test' -AsSecureString
$loginCredential = New-Object System.Management.Automation.PSCredential('admin@example.test', $loginSecret)
$loginBody = @{email='admin@example.test'; password=$loginCredential.GetNetworkCredential().Password} | ConvertTo-Json
try {
    Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/v1/auth/login -ContentType application/json -Headers @{Origin='http://localhost:3000'} -Body $loginBody -SessionVariable vetSession
    Invoke-RestMethod http://localhost:4000/api/v1/me -WebSession $vetSession
    Invoke-RestMethod http://localhost:4000/api/v1/patients -WebSession $vetSession
} finally {
    Remove-Variable loginBody, loginCredential
    $loginSecret.Dispose()
}
```

Los datos sobreviven al reinicio del stack local mediante su volumen existente. No ejecutar `down --volumes` sobre `infra/docker-compose.yml` para actualizar el código.

## 5. Recuperación y pruebas

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/v1/auth/recovery -ContentType application/json -Headers @{Origin='http://localhost:3000'} -Body '{"email":"admin@example.test"}'
```

Ver el mensaje en Mailpit. La pantalla frontend del enlace se integra en Fase 5; la API `/auth/reset` ya acepta `{token,password}` y consume el token. La [prueba Docker de aceptación](../roadmap/cierre-fase-01.md#comandos-de-aceptación) realiza automáticamente todo el flujo HTTP + SMTP sin copiar tokens a documentación.

## Actualización y recuperación ante errores

- Antes de migrar datos de trabajo, crear backup de Postgres. Las pruebas usan otra base, no reemplazan un backup.
- Reiniciar/reconstruir `api` aplica únicamente versiones no registradas. Si falla una migración, el lote pendiente y su registro se revierten; corregir la causa y reintentar.
- No hay migraciones down destructivas automáticas. Para volver a una versión incompatible, restaurar el backup en una base separada y usar la imagen correspondiente. Procedimiento de producción completo: Fase 7.
- `503 mail_unavailable`: falta SMTP o clave. `403 origin`: el encabezado no coincide con PUBLIC_WEB_URL. `400 idempotency_required`: falta clave de escritura de negocio. Consultar [OpenAPI](openapi-fase1.md).
