# OpenAPI — Fase 1

Contrato OpenAPI 3.1 en Markdown por solicitud del usuario. Extraer el bloque JSON para importar en herramientas OpenAPI. Regenerar con `node backend/scripts/export-fase1-openapi.cjs`.

Sesión: access 15 minutos; duración absoluta de sesión/refresh 30 días; recovery 30 minutos de un uso. Cookies httpOnly y SameSite=Lax; Secure con APP_ENV=production. Las expiraciones las valida la base; el reloj de negocio es inyectable. Rate limits por IP y cuenta; respuestas de recuperación iguales para cuenta existente e inexistente.

Listas: arrays, orden estable por ID salvo agenda (startsAt, ID), limit 50 por defecto / máximo 200, offset máximo 100000. Doctores es catálogo de profesionales activos de la clínica. Filtros q usan coincidencia literal sin comodines SQL; status/role de usuarios y species de pacientes usan coincidencia exacta. Filtros clínicos dependientes de PatientStatus quedan pendientes del desarrollador.

Mutaciones de negocio: Idempotency-Key obligatoria, aislada por actor/clínica/método/ruta y cuerpo normalizado; un reintento recupera respuesta canónica. No caducan automáticamente hasta definir retención. JSON desconocido se rechaza. No aceptar clinicId de cliente en recursos de negocio; solo login/cambio de contexto verifican membresía.

Montos: enteros CLP netos; IVA centralizado al 19%, redondeado una vez sobre neto total. MoneyFromNet devuelve net/vat/total/ivaIncluded para presentación bruta. Emisión de factura interna, descuentos conectados a catálogo y DTE corresponden a fases posteriores.

Paciente sin regla de estado aprobada: status null y statusPending true. Respuestas completas/resumidas se amplían en contrato de red Fase 2; este esquema permite esos campos. Errores: error.code/error.message y details opcional; X-Request-ID permite correlación sin registrar secretos.

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "VetData — fundaciones Fase 1",
    "version": "1.0.0",
    "description": "API validation scope. Sharing and operational workflows remain later phases. Money is a reusable calculation schema, not a DTE endpoint."
  },
  "servers": [
    {
      "url": "http://localhost:4000"
    }
  ],
  "security": [
    {
      "accessCookie": []
    }
  ],
  "paths": {
    "/healthz": {
      "get": {
        "summary": "DB readiness",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Health"
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [],
        "security": []
      }
    },
    "/api/v1/health": {
      "get": {
        "summary": "Process liveness",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Health"
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [],
        "security": []
      }
    },
    "/api/v1/auth/login": {
      "post": {
        "summary": "Login active membership",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Authenticated"
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "$ref": "#/components/parameters/Origin"
          }
        ],
        "security": [],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/Login"
              }
            }
          }
        }
      }
    },
    "/api/v1/auth/refresh": {
      "post": {
        "summary": "Rotate refresh; replay revokes session",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Authenticated"
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "$ref": "#/components/parameters/Origin"
          }
        ],
        "security": [
          {
            "refreshCookie": []
          }
        ]
      }
    },
    "/api/v1/auth/logout": {
      "post": {
        "summary": "Revoke session; safe if already logged out",
        "responses": {
          "204": {
            "description": "No content"
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "$ref": "#/components/parameters/Origin"
          }
        ],
        "security": []
      }
    },
    "/api/v1/auth/recovery": {
      "post": {
        "summary": "Generic response; enqueue recovery email",
        "responses": {
          "202": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Message"
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "$ref": "#/components/parameters/Origin"
          }
        ],
        "security": [],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/Recovery"
              }
            }
          }
        }
      }
    },
    "/api/v1/auth/reset": {
      "post": {
        "summary": "Consume recovery token; revoke sessions",
        "responses": {
          "204": {
            "description": "No content"
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "$ref": "#/components/parameters/Origin"
          }
        ],
        "security": [],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/Reset"
              }
            }
          }
        }
      }
    },
    "/api/v1/auth/clinic": {
      "post": {
        "summary": "Switch to active membership; rotate cookies",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ClinicSwitch"
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "$ref": "#/components/parameters/Origin"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ClinicSwitch"
              }
            }
          }
        }
      }
    },
    "/api/v1/me": {
      "get": {
        "summary": "Current session and permissions",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Me"
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": []
      }
    },
    "/api/v1/settings/clinic-profile": {
      "get": {
        "summary": "Own clinic profile",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Profile"
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": []
      },
      "put": {
        "summary": "Replace own clinic profile; usuarios.administrar",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Profile"
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "$ref": "#/components/parameters/Origin"
          },
          {
            "$ref": "#/components/parameters/Idempotency"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ProfileInput"
              }
            }
          }
        }
      }
    },
    "/api/v1/settings/schedule": {
      "get": {
        "summary": "Own clinic structured schedule; agenda.gestionar",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Schedule"
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": []
      },
      "put": {
        "summary": "Replace schedule; usuarios.administrar",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Schedule"
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "$ref": "#/components/parameters/Origin"
          },
          {
            "$ref": "#/components/parameters/Idempotency"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ScheduleInput"
              }
            }
          }
        }
      }
    },
    "/api/v1/doctors/{id}/schedule": {
      "get": {
        "summary": "Doctor schedule; agenda.gestionar",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/DoctorSchedule"
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ]
      },
      "put": {
        "summary": "Replace doctor schedule; usuarios.administrar",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/DoctorSchedule"
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "$ref": "#/components/parameters/Origin"
          },
          {
            "$ref": "#/components/parameters/Idempotency"
          },
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/DoctorScheduleInput"
              }
            }
          }
        }
      }
    },
    "/api/v1/doctors": {
      "get": {
        "summary": "Active professionals in session clinic",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Doctor"
                  }
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": []
      }
    },
    "/api/v1/owners": {
      "get": {
        "summary": "Owners linked to session clinic",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Owner"
                  }
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "$ref": "#/components/parameters/Limit"
          },
          {
            "$ref": "#/components/parameters/Offset"
          },
          {
            "$ref": "#/components/parameters/Q"
          }
        ]
      },
      "post": {
        "summary": "Create owner and clinic link; ficha.editar",
        "responses": {
          "201": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Owner"
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "$ref": "#/components/parameters/Origin"
          },
          {
            "$ref": "#/components/parameters/Idempotency"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/OwnerInput"
              }
            }
          }
        }
      }
    },
    "/api/v1/owners/{rut}": {
      "get": {
        "summary": "Owner by normalized RUT in session clinic",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Owner"
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "name": "rut",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ]
      }
    },
    "/api/v1/patients": {
      "get": {
        "summary": "Authorized patient projections",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Patient"
                  }
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "$ref": "#/components/parameters/Limit"
          },
          {
            "$ref": "#/components/parameters/Offset"
          },
          {
            "$ref": "#/components/parameters/Q"
          },
          {
            "name": "species",
            "in": "query",
            "schema": {
              "type": "string"
            }
          }
        ]
      },
      "post": {
        "summary": "Create patient; ficha.editar",
        "responses": {
          "201": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Patient"
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "$ref": "#/components/parameters/Origin"
          },
          {
            "$ref": "#/components/parameters/Idempotency"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/PatientInput"
              }
            }
          }
        }
      }
    },
    "/api/v1/patients/{id}": {
      "get": {
        "summary": "Authorized patient projection",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Patient"
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ]
      }
    },
    "/api/v1/owners/{rut}/patients": {
      "get": {
        "summary": "Authorized patients for owner",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Patient"
                  }
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "$ref": "#/components/parameters/Limit"
          },
          {
            "$ref": "#/components/parameters/Offset"
          },
          {
            "$ref": "#/components/parameters/Q"
          },
          {
            "name": "rut",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ]
      }
    },
    "/api/v1/appointments/availability": {
      "get": {
        "summary": "Real slots; agenda.gestionar",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Availability"
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "name": "date",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date"
            }
          },
          {
            "name": "doctorId",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            }
          }
        ]
      }
    },
    "/api/v1/appointments": {
      "get": {
        "summary": "Own clinic appointments; agenda.gestionar",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Appointment"
                  }
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "$ref": "#/components/parameters/Limit"
          },
          {
            "$ref": "#/components/parameters/Offset"
          }
        ]
      },
      "post": {
        "summary": "Book slot or explicit emergency; agenda.gestionar",
        "responses": {
          "201": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Appointment"
                }
              }
            }
          },
          "400": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "401": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "403": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "404": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "409": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "415": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "422": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "429": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "500": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          },
          "503": {
            "description": "Structured error; applicable per operation",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Error"
                }
              }
            }
          }
        },
        "parameters": [
          {
            "$ref": "#/components/parameters/Origin"
          },
          {
            "$ref": "#/components/parameters/Idempotency"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AppointmentInput"
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "accessCookie": {
        "type": "apiKey",
        "in": "cookie",
        "name": "vetdata_access"
      },
      "refreshCookie": {
        "type": "apiKey",
        "in": "cookie",
        "name": "vetdata_refresh"
      }
    },
    "parameters": {
      "Origin": {
        "name": "Origin",
        "in": "header",
        "required": true,
        "schema": {
          "type": "string"
        },
        "description": "Exact PUBLIC_WEB_URL origin"
      },
      "Idempotency": {
        "name": "Idempotency-Key",
        "in": "header",
        "required": true,
        "schema": {
          "type": "string",
          "minLength": 8,
          "maxLength": 128
        }
      },
      "Limit": {
        "name": "limit",
        "in": "query",
        "schema": {
          "type": "integer",
          "minimum": 1,
          "maximum": 200,
          "default": 50
        }
      },
      "Offset": {
        "name": "offset",
        "in": "query",
        "schema": {
          "type": "integer",
          "minimum": 0,
          "maximum": 100000,
          "default": 0
        }
      },
      "Q": {
        "name": "q",
        "in": "query",
        "schema": {
          "type": "string"
        }
      }
    },
    "schemas": {
      "Error": {
        "type": "object",
        "properties": {
          "error": {
            "type": "object",
            "properties": {
              "code": {
                "type": "string"
              },
              "message": {
                "type": "string"
              },
              "details": {}
            },
            "required": [
              "code",
              "message"
            ],
            "additionalProperties": false
          }
        },
        "required": [
          "error"
        ],
        "additionalProperties": false
      },
      "Authenticated": {
        "type": "object",
        "properties": {
          "authenticated": {
            "type": "boolean"
          }
        },
        "required": [
          "authenticated"
        ],
        "additionalProperties": false
      },
      "Login": {
        "type": "object",
        "properties": {
          "email": {
            "type": "string",
            "format": "email"
          },
          "password": {
            "type": "string"
          },
          "clinicId": {
            "type": "string",
            "format": "uuid"
          }
        },
        "required": [
          "email",
          "password"
        ],
        "additionalProperties": false
      },
      "Recovery": {
        "type": "object",
        "properties": {
          "email": {
            "type": "string",
            "format": "email"
          }
        },
        "required": [
          "email"
        ],
        "additionalProperties": false
      },
      "Reset": {
        "type": "object",
        "properties": {
          "token": {
            "type": "string"
          },
          "password": {
            "type": "string",
            "description": "12–72 bytes UTF-8"
          }
        },
        "required": [
          "token",
          "password"
        ],
        "additionalProperties": false
      },
      "ClinicSwitch": {
        "type": "object",
        "properties": {
          "clinicId": {
            "type": "string",
            "format": "uuid"
          }
        },
        "required": [
          "clinicId"
        ],
        "additionalProperties": false
      },
      "Message": {
        "type": "object",
        "properties": {
          "message": {
            "type": "string"
          }
        },
        "required": [
          "message"
        ],
        "additionalProperties": false
      },
      "Me": {
        "type": "object",
        "properties": {
          "user": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "format": "uuid"
              },
              "name": {
                "type": "string"
              },
              "email": {
                "type": "string"
              },
              "status": {
                "type": "string"
              },
              "role": {
                "type": "string"
              },
              "lastAccess": {
                "type": [
                  "string",
                  "null"
                ],
                "format": "date-time"
              }
            },
            "required": [
              "id",
              "name",
              "email",
              "status",
              "role",
              "lastAccess"
            ],
            "additionalProperties": false
          },
          "clinic": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "format": "uuid"
              },
              "name": {
                "type": "string"
              },
              "groupId": {
                "type": "string",
                "format": "uuid"
              }
            },
            "required": [
              "id",
              "name",
              "groupId"
            ],
            "additionalProperties": false
          },
          "permissions": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "memberships": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "clinicId": {
                  "type": "string",
                  "format": "uuid"
                },
                "name": {
                  "type": "string"
                },
                "role": {
                  "type": "string"
                }
              },
              "required": [
                "clinicId",
                "name",
                "role"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": [
          "user",
          "clinic",
          "permissions",
          "memberships"
        ],
        "additionalProperties": false
      },
      "ProfileInput": {
        "type": "object",
        "properties": {
          "legalName": {
            "type": "string"
          },
          "rut": {
            "type": "string"
          },
          "address": {
            "type": "string"
          },
          "sector": {
            "type": "string"
          },
          "phone": {
            "type": "string"
          },
          "email": {
            "type": "string"
          }
        },
        "required": [
          "legalName",
          "rut",
          "address",
          "sector",
          "phone",
          "email"
        ],
        "additionalProperties": false
      },
      "Profile": {
        "type": "object",
        "properties": {
          "clinicId": {
            "type": "string",
            "format": "uuid"
          },
          "name": {
            "type": "string"
          },
          "legalName": {
            "type": [
              "string",
              "null"
            ]
          },
          "rut": {
            "type": [
              "string",
              "null"
            ]
          },
          "address": {
            "type": "string"
          },
          "sector": {
            "type": "string"
          },
          "phone": {
            "type": "string"
          },
          "email": {
            "type": "string"
          }
        },
        "required": [
          "clinicId",
          "name",
          "legalName",
          "rut",
          "address",
          "sector",
          "phone",
          "email"
        ],
        "additionalProperties": false
      },
      "Hours": {
        "type": "object",
        "properties": {
          "weekday": {
            "type": "integer",
            "minimum": 0,
            "maximum": 6
          },
          "start": {
            "type": "string",
            "pattern": "^\\d{2}:\\d{2}$"
          },
          "end": {
            "type": "string",
            "pattern": "^\\d{2}:\\d{2}$"
          },
          "slotMinutes": {
            "type": "integer",
            "minimum": 5,
            "maximum": 240
          }
        },
        "required": [
          "weekday",
          "start",
          "end",
          "slotMinutes"
        ],
        "additionalProperties": false
      },
      "DoctorHours": {
        "type": "object",
        "properties": {
          "weekday": {
            "type": "integer",
            "minimum": 0,
            "maximum": 6
          },
          "start": {
            "type": "string"
          },
          "end": {
            "type": "string"
          }
        },
        "required": [
          "weekday",
          "start",
          "end"
        ],
        "additionalProperties": false
      },
      "ScheduleInput": {
        "type": "object",
        "properties": {
          "hours": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/Hours"
            }
          },
          "holidays": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "date": {
                  "type": "string",
                  "format": "date"
                },
                "name": {
                  "type": "string"
                }
              },
              "required": [
                "date",
                "name"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": [
          "hours",
          "holidays"
        ],
        "additionalProperties": false
      },
      "DoctorScheduleInput": {
        "type": "object",
        "properties": {
          "hours": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/DoctorHours"
            }
          }
        },
        "required": [
          "hours"
        ],
        "additionalProperties": false
      },
      "Schedule": {
        "type": "object",
        "properties": {
          "timezone": {
            "type": "string"
          },
          "hours": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/Hours"
            }
          },
          "holidays": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "date": {
                  "type": "string",
                  "format": "date"
                },
                "name": {
                  "type": "string"
                }
              },
              "required": [
                "date",
                "name"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": [
          "timezone",
          "hours",
          "holidays"
        ],
        "additionalProperties": false
      },
      "DoctorSchedule": {
        "type": "object",
        "properties": {
          "doctorId": {
            "type": "string",
            "format": "uuid"
          },
          "inheritsClinicHours": {
            "type": "boolean"
          },
          "hours": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/DoctorHours"
            }
          }
        },
        "required": [
          "doctorId",
          "inheritsClinicHours",
          "hours"
        ],
        "additionalProperties": false
      },
      "Availability": {
        "type": "object",
        "properties": {
          "date": {
            "type": "string",
            "format": "date"
          },
          "doctorId": {
            "type": "string",
            "format": "uuid"
          },
          "timezone": {
            "type": "string"
          },
          "slots": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "startsAt": {
                  "type": "string",
                  "format": "date-time"
                },
                "endsAt": {
                  "type": "string",
                  "format": "date-time"
                }
              },
              "required": [
                "startsAt",
                "endsAt"
              ],
              "additionalProperties": false
            }
          }
        },
        "required": [
          "date",
          "doctorId",
          "timezone",
          "slots"
        ],
        "additionalProperties": false
      },
      "OwnerInput": {
        "type": "object",
        "properties": {
          "rut": {
            "type": "string"
          },
          "firstName": {
            "type": "string"
          },
          "lastName": {
            "type": "string"
          },
          "email": {
            "type": "string"
          },
          "phone": {
            "type": "string"
          },
          "address": {
            "type": "string"
          },
          "sector": {
            "type": "string"
          },
          "region": {
            "type": "string"
          },
          "birthDate": {
            "type": "string",
            "format": "date"
          },
          "preferredContact": {
            "type": "string",
            "enum": [
              "Email",
              "WhatsApp",
              "Teléfono"
            ]
          }
        },
        "required": [
          "rut",
          "firstName",
          "lastName",
          "email",
          "birthDate",
          "preferredContact"
        ],
        "additionalProperties": false
      },
      "Owner": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "rut": {
            "type": "string"
          },
          "firstName": {
            "type": "string"
          },
          "lastName": {
            "type": "string"
          },
          "email": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "rut",
          "firstName",
          "lastName",
          "email"
        ],
        "additionalProperties": true
      },
      "PatientInput": {
        "type": "object",
        "properties": {
          "ownerId": {
            "type": "string",
            "format": "uuid"
          },
          "name": {
            "type": "string"
          },
          "species": {
            "type": "string",
            "enum": [
              "Perro",
              "Gato",
              "Ave",
              "Conejo"
            ]
          },
          "breed": {
            "type": "string"
          },
          "sex": {
            "type": "string",
            "enum": [
              "Macho",
              "Hembra"
            ]
          },
          "birthDate": {
            "type": "string",
            "format": "date"
          },
          "color": {
            "type": "string"
          },
          "sterilized": {
            "type": "boolean"
          },
          "weightKg": {
            "type": "number",
            "minimum": 0
          },
          "chip": {
            "type": "string"
          },
          "allergies": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "conditions": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "ownerId",
          "name",
          "species",
          "sex",
          "birthDate"
        ],
        "additionalProperties": false
      },
      "Patient": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "name": {
            "type": "string"
          },
          "species": {
            "type": "string"
          },
          "breed": {
            "type": "string"
          },
          "clinicId": {
            "type": "string",
            "format": "uuid"
          },
          "accessLevel": {
            "type": "string"
          },
          "scope": {
            "type": "string"
          },
          "status": {
            "type": "null"
          },
          "statusPending": {
            "type": "boolean",
            "const": true
          }
        },
        "required": [
          "id",
          "name",
          "species",
          "clinicId",
          "accessLevel",
          "scope",
          "status",
          "statusPending"
        ],
        "additionalProperties": true
      },
      "Doctor": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "name": {
            "type": "string"
          },
          "specialty": {
            "type": "string"
          },
          "initials": {
            "type": "string"
          },
          "userId": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid"
          }
        },
        "required": [
          "id",
          "name",
          "specialty",
          "initials",
          "userId"
        ],
        "additionalProperties": false
      },
      "AppointmentInput": {
        "type": "object",
        "properties": {
          "patientId": {
            "type": "string",
            "format": "uuid"
          },
          "doctorId": {
            "type": "string",
            "format": "uuid"
          },
          "date": {
            "type": "string",
            "format": "date"
          },
          "time": {
            "type": "string"
          },
          "reason": {
            "type": "string"
          },
          "emergency": {
            "type": "boolean"
          }
        },
        "required": [
          "patientId",
          "doctorId",
          "date",
          "time",
          "reason"
        ],
        "additionalProperties": false
      },
      "Appointment": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "patientId": {
            "type": "string",
            "format": "uuid"
          },
          "doctorId": {
            "type": "string",
            "format": "uuid"
          },
          "date": {
            "type": "string",
            "format": "date"
          },
          "time": {
            "type": "string"
          },
          "startsAt": {
            "type": "string",
            "format": "date-time"
          },
          "endsAt": {
            "type": "string",
            "format": "date-time"
          },
          "status": {
            "type": "string"
          },
          "reason": {
            "type": "string"
          },
          "emergency": {
            "type": "boolean"
          },
          "roomId": {
            "type": [
              "string",
              "null"
            ],
            "format": "uuid"
          }
        },
        "required": [
          "id",
          "patientId",
          "doctorId",
          "date",
          "time",
          "startsAt",
          "endsAt",
          "status",
          "reason",
          "emergency",
          "roomId"
        ],
        "additionalProperties": false
      },
      "Money": {
        "type": "object",
        "properties": {
          "net": {
            "type": "integer",
            "minimum": 0
          },
          "vat": {
            "type": "integer",
            "minimum": 0
          },
          "total": {
            "type": "integer",
            "minimum": 0
          },
          "ivaIncluded": {
            "type": "integer",
            "minimum": 0
          }
        },
        "required": [
          "net",
          "vat",
          "total",
          "ivaIncluded"
        ],
        "additionalProperties": false
      },
      "Health": {
        "type": "object",
        "properties": {
          "status": {
            "type": "string"
          }
        },
        "required": [
          "status"
        ],
        "additionalProperties": true
      }
    }
  }
}
```
