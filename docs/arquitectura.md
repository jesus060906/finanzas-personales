# Arquitectura — Sistema de Gestión de Finanzas Personales

Sistema multiusuario para gestión de finanzas personales. Este documento describe la
arquitectura, el modelo de datos y los endpoints de la API.

## 1. Stack tecnológico

| Capa        | Tecnología                                   | Notas |
|-------------|----------------------------------------------|-------|
| Backend     | Node.js + Express 4                          | API REST |
| Base de datos | SQLite (por defecto, portable) + soporte MySQL | Sequelize 6 + mejor-sqlite3 / mysql2 |
| Auth        | express-session + bcryptjs                   | Sesiones sobre cookies |
| Frontend    | HTML5 + CSS3 + JavaScript (ES modules)       | SPA ligera sin build, tema financiero |
| Reportes    | Páginas HTML imprimibles + exportación CSV   | Filtros por criterios |
| Docs API    | Swagger UI + OpenAPI 3                       | Disponible en `/api-docs` |
| Testing     | Jest + Supertest                             | Tests unitarios e integración |
| Seguridad   | bcrypt para contraseñas, middleware de sesión, validación de entradas | |

El backend usa **SQLite por defecto** (portable, sin instalación, archivo `data/finanzas.db`).
Opcionalmente soporta MySQL vía la variable `DB_DIALECT` (`mysql`), sin reescribir los modelos
gracias a Sequelize; `scripts/migrar-sqlite-a-mysql.js` transfiere los datos de SQLite a MySQL
preservando IDs.

## 2. Arquitectura de capas

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (public/)                                         │
│  login.html · index.html (dashboard SPA) · css · js         │
└───────────────▲─────────────────────────────────────────────┘
                │ fetch JSON (axios-like wrapper)
┌───────────────┴─────────────────────────────────────────────┐
│  API REST (Express)  →  src/routes/*.routes.js              │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────────────────┐  │
│  │ Auth        │ │ Catálogos   │ │ USuarios · Egresos    │  │
│  │ Transacc.   │ │ Cortes      │ │ Reportes              │  │
│  └─────────────┘ └─────────────┘ └───────────────────────┘  │
│                  ↓ (controllers)                            │
│  │ src/controllers/*.controller.js  (lógica de negocio)       │
│  │                  ↓                                          │
│  │ src/models/*.js  (Sequelize: modelos + relaciones)         │
│  │                  ↓                                          │
│  │ MySQL (opcional) / SQLite (por defecto)                  │
└─────────────────────────────────────────────────────────────┘
```

Flujo de cada petición: **Frontend → Ruta → Controller → Modelo → BD → Respuesta JSON**.
El frontend **no** toca la base de datos; todo pasa por la API. La especificación OpenAPI
se sirve en `/api-docs` y el `src/config/swagger.js` la dicta.

## 3. Modelo de datos (esquema relacional)

Corresponde al conjunto mínimo de datos que el sistema necesita almacenar.

- **tipos_egresos**: id, descripcion, estado
- **tipos_ingresos**: id, descripcion, estado
- **renglones**: id, descripcion, estado
- **tipos_pago**: id, descripcion, estado
- **egresos**: id, tipo_egreso_id→tipos_egresos, renglon_id→renglones, tipo_pago_defecto_id→tipos_pago, descripcion, estado
- **ingresos**: id, tipo_ingreso_id→tipos_ingresos, descripcion, institucion, estado
- **usuarios**: id, nombre, cedula, limite_egresos, tipo_persona (Física/Jurídica), fecha_corte (día del mes), estado
- **transacciones**: numero (único), tipo (Ingreso/Egreso), usuario_id→usuarios, egreso_id→egresos | ingreso_id→ingresos, tipo_pago_id→tipos_pago, fecha_transaccion, fecha_registro, monto, no_tarjeta, comentario, estado
- **cortes**: id, anio, mes, fecha_corte, balance_inicial, total_ingresos, total_egresos, balance_corte

### Relaciones
- Usuario (1) → (N) Transacciones
- Egreso (1) → (N) Transacciones · Ingreso (1) → (N) Transacciones
- Tipos de pago / tipos de egreso / renglones → de referencia (estado Activo/Inactivo)

## 4. Endpoints principales

| Método | Ruta                    | Descripción |
|--------|-------------------------|-------------|
| POST   | /api/auth/registro      | Crear usuario |
| POST   | /api/auth/login         | Iniciar sesión |
| POST   | /api/auth/logout        | Cerrar sesión |
| GET    | /api/auth/me            | Sesión actual |
| CRUD   | /api/catalogos/*        | Tipos egreso, tipos ingreso, renglones, tipos pago, egresos, ingresos |
| CRUD   | /api/usuarios           | Gestión de usuarios |
| CRUD   | /api/transacciones      | Registro y listado de transacciones |
| GET    | /api/cortes/proceso     | Ejecutar corte del mes (con tope de mes previo) |
| GET    | /api/cortes             | Historial de cortes |
| GET    | /api/reportes/transacciones?params | Consulta por criterios (usuario, fechas, tipo, estado, monto, renglón) |
| GET    | /api/reportes/corte     | Reporte de corte entre fechas / por usuario |
| GET    | /api/reportes/dashboard | Resumen del dashboard (saldo, límites, último corte, por categoría) |
| GET    | /api-docs               | Documentación Swagger/OpenAPI interactiva |

La especificación completa de esquemas y códigos de respuesta
(200/201/400/401/403/404/409/500) se documenta en `/api-docs`.

## 5. Funcionalidades clave

1. **Catálogos dinámicos**: tipos de egreso/ingreso, renglones, tipos de pago (Activo/Inactivo).
2. **Egresos e ingresos definidos** por el administrador con tipo de pago por defecto.
3. **Usuarios** con cédula, límite de egresos mensual (warning), tipo de persona y fecha de corte.
4. **Transacciones** numeradas automáticamente y asociadas a usuario, tipo de pago y categoría.
5. **Corte mensual**: por cada usuario se resumen balance inicial, total ingresos, total egresos y balance al corte, según su fecha de corte.
6. **Warning de límite**: si el mes supera el límite de egresos del usuario, el sistema muestra una alerta.
7. **Consultas y reportes** por criterios y entre fechas; exportables/imprimibles.

## 6. Seguridad

- Contraseñas con bcrypt (hash con sal).
- Sesiones basadas en cookie httpOnly + middleware `requireAuth`.
- Validación y saneado de entradas en el servidor (`src/utils/validators.js`, `src/utils/http.js`).
- Los usuarios solo ven sus propios datos; el admin gestiona catálogos y usuarios.
- Credenciales de BD y secretos vía variables de entorno (`.env`, ignorado por git; ver `.env.example`).

## 7. Configuración de entorno

| Variable | Valor por defecto | Descripción |
|----------|-------------------|-------------|
| `NODE_ENV` | `development` | `test` no carga `.env` |
| `PORT` | `3000` | Puerto HTTP |
| `SESSION_SECRET` | — | Secreto de `express-session` |
| `DB_DIALECT` | `sqlite` | `sqlite` (por defecto) o `mysql` (opcional) |
| `DB_STORAGE` | `data/finanzas.db` | Archivo SQLite (solo `sqlite`) |
| `DB_HOST` / `DB_PORT` | `localhost` / `3306` | Servidor MySQL (solo `mysql`) |
| `DB_NAME` | — | Nombre de la base de datos (solo `mysql`) |
| `DB_USER` / `DB_PASSWORD` | — | Credenciales MySQL (solo `mysql`) |

Los tests usan SQLite en memoria (`tests/setup.js`). Para cambiar a MySQL:
`scripts/migrar-sqlite-a-mysql.js` transfiere datos desde una BD SQLite existente.

## 8. Estructura de carpetas

```
finanzas-personales/
├── docs/arquitectura.md
├── scripts/
│   └── migrar-sqlite-a-mysql.js   # migración de datos
├── src/
│   ├── server.js              # arranque
│   ├── app.js                 # configuración Express + /api-docs + estáticos
│   ├── config/db.js           # conexión Sequelize (mysql|sqlite)
│   ├── config/swagger.js      # spec OpenAPI 3
│   ├── models/index.js        # carga de modelos
│   ├── models/*.js            # modelos
│   ├── middlewares/auth.js
│   ├── routes/*.routes.js
│   ├── controllers/*.controller.js
│   ├── utils/validators.js    # helpers de validación
│   ├── utils/http.js          # helpers de respuesta/errores
│   └── seed.js                # datos iniciales
├── tests/
│   ├── setup.js               # SQLite en memoria + seed
│   ├── helpers.js
│   ├── unit/
│   └── integration/
├── public/
│   ├── login.html
│   ├── index.html             # dashboard SPA
│   ├── css/style.css
│   ├── js/                    # módulos frontend
│   └── assets/
├── data/                      # finanzas.db (generada, solo sqlite)
├── package.json
├── .env.example
└── .gitignore
```