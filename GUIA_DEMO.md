# Guía rápida de la demo

Aplicación: **http://localhost:3000** (levantar con `npm start` desde la raíz del proyecto).
La BD se siembra sola al arrancar si está vacía (4 usuarios demo, 15 transacciones, 2 cortes).

## Credenciales

| Usuario | Cédula / RNC | Contraseña | Tipo | Límite egresos | Día de corte |
|---|---|---|---|---|---|
| Administrador | `000-0000000-0` | `admin123` | JURÍDICA · ADMIN | — | 1 |
| Juan Pérez | `001-1234567-3` | `usuario123` | FÍSICA | RD$15,000 | 15 |
| Carlos Rivera | `402-1234567-8` | `usuario123` | FÍSICA | RD$30,000 | 10 |
| Comercial Norte, S.R.L. | `130-12345-4` | `empresa123` | JURÍDICA | RD$200,000 | 28 |

> En el login el campo dice **"Cédula o RNC"**: personas físicas entran con cédula y las empresas (Comercial Norte) con su RNC (solo cifras, sin el prefijo).

## Ruta sugerida (~15 min)

### 1) Admin — `000-0000000-0`
- **Dashboard**: KPIs de balance, ingresos, egresos del mes e histórico.
- **Usuarios**: tabla con los 4 usuarios; mostrar columna Cédula, Tipo (FÍSICA/JURÍDICA), Límite y Día de corte.
- **Transacciones**: listado con filtros. Registrar una: elegir usuario **Carlos Rivera**, egreso por **RD$35,000** (su límite es 30,000) → la app guarda y muestra el aviso *"límite superado"*. Luego **Anular** una transacción (pasa a inactiva y desaparece del listado).
- **Cortes**: historial (Juan y Comercial Norte ya tienen su corte del mes). Con el **mes en curso** seleccionado el botón *Procesar* está **deshabilitado** y se muestra el aviso *"el período está en curso"*.
- **Reportes**: consultar **Egresos** (trae filas + totales), exportar **CSV**, consultar **cortes**.
- **Contabilidad** (visible por ser JURÍDICA/ADMIN): Plan de Cuentas, Asientos (editor con 2 líneas y el indicador **"Cuadra"**), Períodos Contables.

### 2) Comercial Norte — `130-12345-4` (empresa)
- Dashboard corporativo y menú **Contabilidad** visible (por contral, sin Usuarios).
- *(opcional)* Crear una cuenta en el plan y un asiento balanceado para mostrar escritura.

### 3) Carlos — `402-1234567-8` (persona física)
- No ve los menús **Usuarios** ni **Contabilidad**; si intenta `#/usuarios` la app lo redirige al dashboard (control de permisos).
- **Transacciones**: con su límite de 30,000, repetir el caso *límite superado*.

### 4) Cierre
- Hacer logout y verificar la redirección a `/login.html`.

## Restaurar los datos de demo
Si durante la demo se registran/crean datos y quieres dejarlo como al inicio: detén el servidor, borra `data/finanzas.db` y arranca de nuevo (se re-siembra).