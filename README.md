# Sistema de Gestión de Finanzas Personales

[![Pruebas](https://github.com/jesus060906/finanzas-personales/actions/workflows/tests.yml/badge.svg)](https://github.com/jesus060906/finanzas-personales/actions/workflows/tests.yml)
[![Licencia](https://img.shields.io/badge/Licencia-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-18%20%7C%2020%20%7C%2022-5FA04E)](package.json)
[![Express](https://img.shields.io/badge/Express-4-000000.svg)](https://expressjs.com)

Aplicación web multiusuario para registrar ingresos y egresos, llevar el corte
mensual de cada usuario y —para personas jurídicas— llevar un módulo de
contabilidad básica con plan de cuentas, asientos y libros contables.

Construida con **Node.js + Express** en el backend y **JavaScript puro** en el
frontend, sin framework ni paso de build.

---

## Características

- **Roles y permisos.** Administrador, persona física y persona jurídica, con
  control de acceso en el servidor (ocultar un botón no es la protección).
- **Autenticación por cédula o RNC** con sesiones en servidor y *rate limiting*
  en los endpoints de registro y login.
- **Límite de egresos por usuario.** Al superarlo la app lo permite pero avisa y
  deja constancia del estado del límite.
- **Corte mensual** por usuario, con balance de ingresos y egresos y bloqueo de
  los períodos en curso.
- **Contabilidad** para personas jurídicas: plan de cuentas, asientos
  balanceados, libro diario, libro mayor y balance de comprobación.
- **Reportes** con exportación a **CSV**, **Excel** y **PDF**.
- **Validación de cédulas y RNC dominicanos** con dígito verificador propio
  (módulo ponderado mod 10 para cédulas, mod 11/9 para RNC), más una lista
  blanca de identificadores reservados para las pruebas.
- **Documentación OpenAPI** interactiva en `/api-docs`.
- **Suite de pruebas automatizadas** (Jest + Supertest), 161 casos.

---

## Requisitos

- **Node.js 18 o superior** (probado en v22)
- **npm 9 o superior**
- SQLite (incluido) o MySQL (opcional). No hace falta instalar una base de datos
  para usar el proyecto.

---

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Crear el archivo de entorno
cp .env.example .env      # en Windows: copy .env.example .env

# 3. Arrancar
npm start
```

Abre **http://localhost:3000**

La base de datos se crea y se siembra **automáticamente** al arrancar por
primera vez: 4 usuarios de demostración, 15 transacciones y 2 cortes. No hay
nada que configurar.

> **No es obligatorio definir `SESSION_SECRET` para desarrollo**, la app usa un
> valor local por defecto. Pero en producción es **obligatorio**: si falta, el
> servidor se niega a arrancar a propósito.

### Scripts disponibles

| Comando | Qué hace |
|---|---|
| `npm start` | Arranca el servidor |
| `npm run dev` | Arranca con recarga automática (`node --watch`) |
| `npm test` | Corre las pruebas |
| `npm run test:watch` | Pruebas en modo interactivo |
| `npm run test:coverage` | Pruebas con reporte de cobertura |
| `npm run migrate:sqlite-mysql` | Migra los datos de SQLite a MySQL |

---

## Credenciales de demostración

La base se siembra sola con estos usuarios:

| Usuario | Cédula / RNC | Contraseña | Tipo | Límite egresos | Día de corte |
|---|---|---|---|---|---|
| Administrador | `000-0000000-0` | `admin123` | Jurídica · Admin | — | 1 |
| Juan Pérez | `001-1234567-3` | `usuario123` | Física | RD$15,000 | 15 |
| Carlos Rivera | `402-1234567-8` | `usuario123` | Física | RD$30,000 | 10 |
| Comercial Norte, S.R.L. | `130-12345-4` | `empresa123` | Jurídica | RD$200,000 | 28 |

> En el login el campo dice **"Cédula o RNC"**: las personas físicas entran con su
> cédula y las empresas con su RNC (solo cifras, sin guiones ni letra inicial).

Cada usuario tiene un menú distinto según su rol. La guía con una ruta de
demostración paso a paso está en **[GUIA_DEMO.md](GUIA_DEMO.md)**.

---

## Configuración

Todas las variables son opcionales en desarrollo. Copia `.env.example` a `.env`
y ajústalas si necesitas.

| Variable | Por defecto | Descripción |
|---|---|---|
| `DB_DIALECT` | `sqlite` | `sqlite` o `mysql` |
| `DB_STORAGE` | `data/finanzas.db` | Ruta del archivo SQLite |
| `SESSION_SECRET` | *(valor local de desarrollo)* | **Obligatoria en producción** |
| `PORT` | `3000` | Puerto del servidor |

Para MySQL:

```env
DB_DIALECT=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=finanzas_personales
DB_USER=root
DB_PASSWORD=
DB_TIMEZONE=-04:00
```

Si vienes de SQLite, `npm run migrate:sqlite-mysql` te lleva los datos.

---

## Estructura del proyecto

```
src/
├── server.js              Arranque: sincroniza el esquema y siembra datos
├── app.js                 Configuración de Express, sesiones, rutas
├── seed.js                Datos de demostración
├── config/
│   ├── db.js              Conexión Sequelize
│   └── swagger.js         Especificación OpenAPI
├── models/index.js        Los 13 modelos de datos
├── controllers/           Lógica de cada endpoint
├── routes/                Rutas y middlewares de autorización
├── middlewares/auth.js    requireAuth, requireAdmin, requireEmpresa
└── utils/                 Validadores, helpers de HTTP, listas blancas

public/                    Frontend (JS puro, sin build)
├── login.html
├── index.html
├── js/
│   ├── app.js             Router por hash
│   ├── api.js             Cliente HTTP
│   └── views/             Una vista por pantalla
└── css/style.css

tests/
├── unit/                  Pruebas de lógica pura
└── integration/           Pruebas de endpoint con Supertest

docs/arquitectura.md       Detalle técnico del diseño
```

---

## API

Todas las rutas cuelgan de `/api` y salvo registro y login exigen sesión activa.

| Módulo | Rutas |
|---|---|
| **Auth** | `POST /auth/registro` · `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` |
| **Usuarios** | `GET /usuarios` · `GET /usuarios/:id` · `GET /usuarios/resumen` · `POST /usuarios` · `PUT /usuarios/:id` · `PATCH /usuarios/:id/anular` |
| **Transacciones** | `GET /transacciones` · `POST /transacciones` · `PATCH /transacciones/:id/anular` |
| **Cortes** | `GET /cortes` · `POST /cortes/proceso` |
| **Reportes** | `GET /reportes/dashboard` · `GET /reportes/transacciones` · `GET /reportes/corte` |
| **Catálogos** | `GET/POST/PUT/DELETE /catalogos/{egresos,ingresos,tipos,renglones,metodos}` |
| **Contabilidad** | `/contabilidad/cuentas` · `/contabilidad/asientos` · `/contabilidad/periodos` · `GET /contabilidad/libro-diario` · `GET /contabilidad/libro-mayor` · `GET /contabilidad/balance-comprobacion` |

Documentación interactiva con ejemplos de request y response:

**http://localhost:3000/api-docs**

---

## Modelo de datos

Trece modelos. Los tres que sostienen el negocio:

- **Usuario** — cédula o RNC, contraseña (bcrypt), rol, tipo de persona, límite
  de egresos y día de corte.
- **Transaccion** — une un usuario con un ingreso o egreso, guarda monto, tipo
  de pago, fecha y estado (activa/inactiva).
- **Corte** — snapshot mensual por usuario con balance inicial, totales y
  balance final.

El resto: catálogos (`TipoIngreso`, `TipoEgreso`, `Renglon`, `TipoPago`,
`Ingreso`, `Egreso`) y contabilidad (`CuentaContable`, `PeriodoContable`,
`AsientoContable`, `AsientoLinea`).

El detalle completo está en **[docs/arquitectura.md](docs/arquitectura.md)**.

---

## Seguridad

- Contraseñas con **bcrypt**, nunca en texto plano.
- Sesiones en servidor con cookie `httpOnly` y `sameSite`.
- **Helmet** para cabeceras de seguridad y **CORS** configurado.
- **Rate limiting** en registro y login.
- Autorización por rol validada **en el servidor** en cada endpoint.
- Variables sensibles fuera del código; `.env` está en `.gitignore`.

---

## Pruebas

```bash
npm test
```

161 casos cubriendo validación de cédulas, límites de corte, permisos por rol,
anulación de transacciones, asientos contables y reglas de consistencia.

---

## Licencia

MIT
