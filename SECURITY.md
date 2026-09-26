# Política de Seguridad

## Versiones soportadas

| Versión | Node.js | Estado |
|---|---|---|
| 1.x | 20.17 o superior | Soportada |

El mínimo de Node lo impone `sqlite3` 6.x. Node 18 ya no es una combinación
soportada.

## Reportar una vulnerabilidad

Si encuentras un fallo de seguridad, repórtalo por email privado en lugar de
abrir un issue público.

**No abras un issue público para reportar una vulnerabilidad.** Un issue
público le avisa a todo el mundo antes de que haya un arreglo.

Incluye en el reporte:

- Descripción del problema y su impacto
- Pasos para reproducirlo
- Versión de Node, del sistema y del commit afectado
- Cualquier detalle que ayude a confirmar el hallazgo

Me comprometo a acusar recibo en un plazo de 72 horas, a confirmar la
vulnerabilidad y a publicar un arreglo. Si el reporte es válido, coordinamos la
publicación del aviso y la fecha de la corrección.

## Superficie de ataque

La aplicación expone una API HTTP con sesiones por cookie. Puntos de entrada
que aceptan datos de usuarios:

- `POST /api/auth/registro` y `POST /api/auth/login` — únicos endpoints públicos
- Todas las rutas bajo `/api`, que exigen sesión activa
- Exportaciones a CSV, XLSX y PDF, que generan archivos a partir de datos
  almacenados
- Entrada de cédula o RNC, validada contra el dígito verificador

## Medidas implementadas

- Contraseñas con **bcrypt**, nunca en texto plano
- Sesiones en servidor con cookie `httpOnly` y `sameSite`
- **Helmet** para cabeceras de seguridad
- **Rate limiting** con `express-rate-limit` en registro y login (30 intentos
  por 15 minutos, configurable con `AUTH_MAX_ATTEMPTS`)
- Autorización por rol validada **en el servidor** en cada endpoint, no solo en
  la interfaz
- Validación de cédulas y RNC por dígito verificador
- `.env` fuera del control de versiones; `SESSION_SECRET` es **obligatorio** en
  producción y el servidor se niega a arrancar sin él
- Salida de imágenes: el JSON de error del servidor no expone trazas de pila
  (`res.status(500).json({ error: 'Error interno del servidor.' })`)

## Sobre CORS

La aplicación **no configura CORS** porque no lo necesita: el frontend se
sirve desde el mismo origen que la API (`express.static` sobre `public/` y las
rutas bajo `/api`). Los navegadores sólo exigen CORS cuando el cliente llama a
otro origen distinto, y aquí no ocurre.

Por eso el paquete `cors` fue eliminado de las dependencias. Si en el futuro se
expone la API a un cliente en otro dominio, habría que añadirlo de vuelta con
una lista de orígenes explícita, nunca con comodín.

## Estado de dependencias

`npm audit` reporta 2 avisos moderados, ambos en `uuid`, que Sequelize fija en
`^8.3.2` mientras el aviso requiere `>=11.1.1`. El fallo afecta a las variantes
v3/v5/v6 cuando reciben un buffer; el proyecto no importa `uuid` y Sequelize
solo usa v4, que no es la ruta afectada. Cerrarlo exigiría cambiar Sequelize de
versión mayor, con un riesgo muy superior al de la propia vulnerabilidad.

```bash
npm audit
```
