'use strict';

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Finanzas Personales API',
    description:
      'API REST del Sistema de Gestión de Finanzas Personales (multiusuario).\n\n'
      + 'Autenticación por **sesión en cookie** (`finanzas.sid`, httpOnly). '
      + 'Para probar endpoints protegidos, inicie sesión primero con `POST /api/auth/login` '
      + 'desde esta misma página: la cookie quedará disponible para el resto de las peticiones.',
    version: '1.0.0',
  },
  servers: [{ url: '/', description: 'Servidor local (Express)' }],
  tags: [
    { name: 'Autenticación', description: 'Registro, inicio y cierre de sesión' },
    { name: 'Catálogos', description: 'Tipos de egreso/ingreso, renglones, tipos de pago' },
    { name: 'Egresos definidos', description: 'Definiciones de egresos (relacionadas a catálogos)' },
    { name: 'Ingresos definidos', description: 'Definiciones de ingresos' },
    { name: 'Usuarios', description: 'Gestión de usuarios (administración)' },
    { name: 'Transacciones', description: 'Registro, listado y anulación de transacciones' },
    { name: 'Cortes', description: 'Proceso y consulta de cortes mensuales' },
    { name: 'Reportes y Consultas', description: 'Consultas filtradas, reporte de corte y resumen' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'finanzas.sid' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string', example: 'Mensaje de error.' } },
      },
      Estado: { type: 'string', enum: ['ACTIVO', 'INACTIVO'], example: 'ACTIVO' },
      Catalogo: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          descripcion: { type: 'string', example: 'Gasto' },
          estado: { $ref: '#/components/schemas/Estado' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Egreso: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          tipoEgresoId: { type: 'integer', example: 1 },
          renglonId: { type: 'integer', example: 1 },
          tipoPagoDefectoId: { type: 'integer', example: 1 },
          descripcion: { type: 'string', example: 'Compra Supermercado' },
          estado: { $ref: '#/components/schemas/Estado' },
        },
      },
      Ingreso: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          tipoIngresoId: { type: 'integer', example: 1 },
          descripcion: { type: 'string', example: 'Salario Base' },
          institucion: { type: 'string', example: 'Empresa Demo' },
          estado: { $ref: '#/components/schemas/Estado' },
        },
      },
      Usuario: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nombre: { type: 'string', example: 'Juan Pérez' },
          cedula: { type: 'string', example: '001-1234567-3' },
          email: { type: 'string', example: 'juan@finanzas.local' },
          limiteEgresos: { type: 'number', nullable: true, example: 15000 },
          tipoPersona: { type: 'string', enum: ['FISICA', 'JURIDICA'] },
          fechaCorte: { type: 'integer', example: 15 },
          rol: { type: 'string', enum: ['ADMIN', 'USUARIO'] },
          estado: { $ref: '#/components/schemas/Estado' },
        },
      },
      Transaccion: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          numero: { type: 'string', example: 'TRX-EG-2026-000001' },
          tipo: { type: 'string', enum: ['INGRESO', 'EGRESO'] },
          usuarioId: { type: 'integer' },
          egresoId: { type: 'integer', nullable: true },
          ingresoId: { type: 'integer', nullable: true },
          tipoPagoId: { type: 'integer' },
          fechaTransaccion: { type: 'string', format: 'date', example: '2026-09-15' },
          fechaRegistro: { type: 'string', format: 'date-time' },
          monto: { type: 'number', example: 3200.5 },
          noTarjeta: { type: 'string', nullable: true, pattern: '^\\d{15,16}$', minLength: 15, maxLength: 16, example: '4111111111111111', description: 'Solo dígitos, 15 o 16. Opcional.' },
          comentario: { type: 'string', nullable: true },
          estado: { $ref: '#/components/schemas/Estado' },
        },
      },
      Corte: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          usuarioId: { type: 'integer' },
          anio: { type: 'integer', example: 2026 },
          mes: { type: 'integer', example: 9 },
          fechaCorte: { type: 'string', format: 'date' },
          balanceInicial: { type: 'number', example: 0 },
          totalIngresos: { type: 'number', example: 30000 },
          totalEgresos: { type: 'number', example: 13700.5 },
          balanceCorte: { type: 'number', example: 16299.5 },
        },
      },
      AdvertenciaLimite: {
        type: 'object',
        properties: {
          tipo: { type: 'string', example: 'LIMITE_EXCEDIDO' },
          mensaje: { type: 'string' },
          total: { type: 'number' },
          limite: { type: 'number' },
          pct: { type: 'number' },
        },
      },
    },
  },
  paths: {
    // ===================== AUTENTICACIÓN =====================
    '/api/auth/registro': {
      post: {
        tags: ['Autenticación'],
        summary: 'Crear usuario (registro abierto — siempre con rol USUARIO)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nombre', 'cedula', 'password'],
                properties: {
                  nombre: { type: 'string', example: 'Ana Torres' },
                  cedula: { type: 'string', example: '001-1111111-8', description: 'Cédula de 11 dígitos si tipoPersona=FISICA; RNC de 9 dígitos si es JURIDICA' },
                  email: { type: 'string', example: 'ana@finanzas.local' },
                  password: { type: 'string', format: 'password', example: 'clave123' },
                  limiteEgresos: { type: 'number', example: 5000 },
                  tipoPersona: { type: 'string', enum: ['FISICA', 'JURIDICA'], default: 'FISICA' },
                  fechaCorte: { type: 'integer', minimum: 1, maximum: 28, default: 1 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Usuario creado' },
          400: { description: 'Datos inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          409: { description: 'Cédula ya registrada', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Autenticación'],
        summary: 'Iniciar sesión (establece cookie de sesión)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['cedula', 'password'],
                properties: {
          cedula: { type: 'string', example: '402-1234567-8', description: 'Cédula (11 dígitos, FISICA) o RNC (9 dígitos, JURIDICA). No se valida cuando rol=ADMIN.' },
                  password: { type: 'string', format: 'password', example: 'usuario123' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Sesión iniciada',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { id: { type: 'integer' }, nombre: { type: 'string' }, cedula: { type: 'string' }, rol: { type: 'string' } } },
              },
            },
          },
          400: { description: 'Cédula/contraseña faltantes' },
          401: { description: 'Credenciales inválidas o usuario inactivo' },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Autenticación'],
        summary: 'Cerrar sesión',
        responses: {
          200: { description: 'Sesión cerrada' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Autenticación'],
        summary: 'Información de la sesión actual',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Datos del usuario autenticado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Usuario' } } } },
          401: { description: 'No autenticado' },
        },
      },
    },

    // ===================== CATÁLOGOS SIMPLES =====================
    '/api/catalogos/{catalogo}': {
      parameters: [
        {
          name: 'catalogo',
          in: 'path',
          required: true,
          schema: { type: 'string', enum: ['tipos-egresos', 'tipos-ingresos', 'renglones', 'tipos-pago'] },
        },
      ],
      get: {
        tags: ['Catálogos'],
        summary: 'Listar registros de un catálogo (tipos-egresos, tipos-ingresos, renglones, tipos-pago)',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Lista de registros', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Catalogo' } } } } },
          401: { description: 'No autenticado' },
        },
      },
      post: {
        tags: ['Catálogos'],
        summary: 'Crear registro en el catálogo (solo admin)',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['descripcion'],
                properties: {
                  descripcion: { type: 'string', maxLength: 120, example: 'Inversión' },
                  estado: { $ref: '#/components/schemas/Estado' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Registro creado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Catalogo' } } } },
          400: { description: 'Descripción inválida' },
          403: { description: 'Requiere rol administrador' },
          409: { description: 'Descripción duplicada' },
        },
      },
    },
    '/api/catalogos/{catalogo}/{id}': {
      parameters: [
        { name: 'catalogo', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
      ],
      put: {
        tags: ['Catálogos'],
        summary: 'Actualizar descripción y/o estado (solo admin)',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { descripcion: { type: 'string' }, estado: { $ref: '#/components/schemas/Estado' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Registro actualizado' },
          400: { description: 'Datos inválidos' },
          403: { description: 'Requiere rol administrador' },
          404: { description: 'Registro no encontrado' },
        },
      },
      delete: {
        tags: ['Catálogos'],
        summary: 'Desactivar (soft delete) registro (solo admin)',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Registro desactivado' },
          403: { description: 'Requiere rol administrador' },
          404: { description: 'Registro no encontrado' },
        },
      },
    },

    // ===================== EGRESOS DEFINIDOS =====================
    '/api/catalogos/egresos': {
      get: {
        tags: ['Egresos definidos'],
        summary: 'Listar egresos definidos (con tipo, renglón y pago por defecto)',
        security: [{ cookieAuth: [] }],
        responses: { 200: { description: 'Lista de egresos' } },
      },
      post: {
        tags: ['Egresos definidos'],
        summary: 'Crear egreso definido (solo admin)',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tipoEgresoId', 'renglonId', 'tipoPagoDefectoId', 'descripcion'],
                properties: {
                  tipoEgresoId: { type: 'integer', example: 1 },
                  renglonId: { type: 'integer', example: 1 },
                  tipoPagoDefectoId: { type: 'integer', example: 1 },
                  descripcion: { type: 'string', example: 'Compra Supermercado' },
                  estado: { $ref: '#/components/schemas/Estado' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Egreso creado' },
          400: { description: 'Campos obligatorios o relaciones inexistentes' },
          403: { description: 'Requiere rol administrador' },
        },
      },
    },
    '/api/catalogos/egresos/activos': {
      get: {
        tags: ['Egresos definidos'],
        summary: 'Listar egresos definidos activos',
        security: [{ cookieAuth: [] }],
        responses: { 200: { description: 'Lista de egresos activos' } },
      },
    },
    '/api/catalogos/egresos/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      put: {
        tags: ['Egresos definidos'],
        summary: 'Actualizar egreso (solo admin)',
        security: [{ cookieAuth: [] }],
        responses: { 200: { description: 'Egreso actualizado' }, 400: { description: 'Datos inválidos' }, 404: { description: 'No encontrado' } },
      },
      delete: {
        tags: ['Egresos definidos'],
        summary: 'Desactivar egreso (solo admin)',
        security: [{ cookieAuth: [] }],
        responses: { 200: { description: 'Egreso desactivado' }, 404: { description: 'No encontrado' } },
      },
    },

    // ===================== INGRESOS DEFINIDOS =====================
    '/api/catalogos/ingresos': {
      get: {
        tags: ['Ingresos definidos'],
        summary: 'Listar ingresos definidos',
        security: [{ cookieAuth: [] }],
        responses: { 200: { description: 'Lista de ingresos' } },
      },
      post: {
        tags: ['Ingresos definidos'],
        summary: 'Crear ingreso definido (solo admin)',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tipoIngresoId', 'descripcion'],
                properties: {
                  tipoIngresoId: { type: 'integer', example: 1 },
                  descripcion: { type: 'string', example: 'Salario Base' },
                  institucion: { type: 'string', example: 'Empresa Demo' },
                  estado: { $ref: '#/components/schemas/Estado' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Ingreso creado' }, 400: { description: 'Datos inválidos' }, 403: { description: 'Requiere rol administrador' } },
      },
    },
    '/api/catalogos/ingresos/activos': {
      get: {
        tags: ['Ingresos definidos'],
        summary: 'Listar ingresos definidos activos',
        security: [{ cookieAuth: [] }],
        responses: { 200: { description: 'Lista de ingresos activos' } },
      },
    },
    '/api/catalogos/ingresos/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      put: {
        tags: ['Ingresos definidos'],
        summary: 'Actualizar ingreso (solo admin)',
        security: [{ cookieAuth: [] }],
        responses: { 200: { description: 'Ingreso actualizado' }, 404: { description: 'No encontrado' } },
      },
      delete: {
        tags: ['Ingresos definidos'],
        summary: 'Desactivar ingreso (solo admin)',
        security: [{ cookieAuth: [] }],
        responses: { 200: { description: 'Ingreso desactivado' }, 404: { description: 'No encontrado' } },
      },
    },

    // ===================== USUARIOS =====================
    '/api/usuarios': {
      get: {
        tags: ['Usuarios'],
        summary: 'Listar usuarios (solo admin)',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Lista de usuarios (sin contraseñas)', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Usuario' } } } } },
          403: { description: 'Requiere rol administrador' },
        },
      },
      post: {
        tags: ['Usuarios'],
        summary: 'Crear usuario (solo admin)',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nombre', 'cedula', 'password'],
                properties: {
                  nombre: { type: 'string' },
                  cedula: { type: 'string', description: 'Cédula de 11 dígitos (FISICA) o RNC de 9 dígitos (JURIDICA). No se valida cuando rol=ADMIN.' },
                  email: { type: 'string' },
                  password: { type: 'string', format: 'password' },
                  limiteEgresos: { type: 'number' }, tipoPersona: { type: 'string', enum: ['FISICA', 'JURIDICA'] },
                  fechaCorte: { type: 'integer', minimum: 1, maximum: 28 },
                  rol: { type: 'string', enum: ['ADMIN', 'USUARIO'] },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Usuario creado' },
          400: { description: 'Datos inválidos' }, 403: { description: 'Requiere rol administrador' },
          409: { description: 'Cédula duplicada' },
        },
      },
    },
    '/api/usuarios/resumen': {
      get: {
        tags: ['Usuarios'],
        summary: 'Resumen financiero por usuario (solo admin)',
        security: [{ cookieAuth: [] }],
        responses: { 200: { description: 'Totales de ingresos/egresos/balance y estado del límite por usuario' } },
      },
    },
    '/api/usuarios/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      get: {
        tags: ['Usuarios'],
        summary: 'Obtener un usuario (propio o admin)',
        security: [{ cookieAuth: [] }],
        responses: { 200: { description: 'Datos del usuario' }, 403: { description: 'Requiere rol administrador' }, 404: { description: 'No encontrado' } },
      },
      put: {
        tags: ['Usuarios'],
        summary: 'Actualizar usuario (solo admin) — campo password opcional',
        security: [{ cookieAuth: [] }],
        responses: { 200: { description: 'Usuario actualizado' }, 400: { description: 'Datos inválidos' }, 409: { description: 'Cédula duplicada' } },
      },
    },
    '/api/usuarios/{id}/anular': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      patch: {
        tags: ['Usuarios'],
        summary: 'Activar/desactivar usuario (solo admin)',
        security: [{ cookieAuth: [] }],
        responses: { 200: { description: 'Estado alternado' }, 404: { description: 'No encontrado' } },
      },
    },

    // ===================== TRANSACCIONES =====================
    '/api/transacciones': {
      get: {
        tags: ['Transacciones'],
        summary: 'Listar transacciones (máx. 500). Usuarios ven solo las propias.',
        security: [{ cookieAuth: [] }],
        responses: { 200: { description: 'Lista de transacciones', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Transaccion' } } } } } },
      },
      post: {
        tags: ['Transacciones'],
        summary: 'Registrar transacción (ingreso o egreso)',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tipo', 'fechaTransaccion', 'monto'],
                properties: {
                  tipo: { type: 'string', enum: ['INGRESO', 'EGRESO'], example: 'EGRESO' },
                  usuarioId: { type: 'integer', description: 'Solo admin puede indicar otro usuario' },
                  egresoId: { type: 'integer', description: 'Obligatorio si tipo=EGRESO' },
                  ingresoId: { type: 'integer', description: 'Obligatorio si tipo=INGRESO' },
                  tipoPagoId: { type: 'integer', description: 'Si se omite en egresos, se usa el tipo de pago por defecto' },
                  fechaTransaccion: { type: 'string', format: 'date', example: '2026-09-15' },
                  monto: { type: 'number', exclusiveMinimum: 0, example: 3200.5 },
                  noTarjeta: { type: 'string', nullable: true, pattern: '^\\d{15,16}$', minLength: 15, maxLength: 16, example: '4111111111111111', description: 'Opcional. Solo dígitos, exactamente 15 o 16' },
                  comentario: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Transacción creada (puede incluir advertencia de límite)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    transaccion: { $ref: '#/components/schemas/Transaccion' },
                    advertencia: { $ref: '#/components/schemas/AdvertenciaLimite' },
                  },
                },
              },
            },
          },
          400: { description: 'Datos inválidos (tipo, monto, fecha, relaciones)' },
        },
      },
    },
    '/api/transacciones/{id}/anular': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      patch: {
        tags: ['Transacciones'],
        summary: 'Anular transacción (soft delete). Solo el dueño o admin.',
        security: [{ cookieAuth: [] }],
        responses: { 200: { description: 'Transacción anulada' }, 403: { description: 'No autorizado' }, 404: { description: 'No encontrada' } },
      },
    },

    // ===================== CORTES =====================
    '/api/cortes/proceso': {
      post: {
        tags: ['Cortes'],
        summary: 'Procesar corte mensual por usuario(s)',
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: 'anio', in: 'query', schema: { type: 'integer', example: 2026 } },
          { name: 'mes', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 12, example: 9 } },
          { name: 'usuarioId', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'Cortes procesados (o omitidos si ya existían)' },
          400: { description: 'Año/mes inválidos o período aún en curso (no puede cerrarse el mes actual)' },
          403: { description: 'No puede procesar cortes de otro usuario' },
        },
      },
    },
    '/api/cortes': {
      get: {
        tags: ['Cortes'],
        summary: 'Historial de cortes',
        security: [{ cookieAuth: [] }],
        parameters: [{ name: 'usuarioId', in: 'query', schema: { type: 'integer' } }],
        responses: { 200: { description: 'Lista de cortes', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Corte' } } } } } },
      },
    },

    // ===================== REPORTES Y CONSULTAS =====================
    '/api/reportes/transacciones': {
      get: {
        tags: ['Reportes y Consultas'],
        summary: 'Consulta de transacciones por criterios combinables',
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: 'usuarioId', in: 'query', schema: { type: 'integer' }, description: 'Solo admin' },
          { name: 'desde', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'hasta', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'tipo', in: 'query', schema: { type: 'string', enum: ['INGRESO', 'EGRESO'] } },
          { name: 'egresoId', in: 'query', schema: { type: 'integer' } },
          { name: 'ingresoId', in: 'query', schema: { type: 'integer' } },
          { name: 'tipoEgresoId', in: 'query', schema: { type: 'integer' } },
          { name: 'tipoIngresoId', in: 'query', schema: { type: 'integer' } },
          { name: 'renglonId', in: 'query', schema: { type: 'integer' } },
          { name: 'tipoPagoId', in: 'query', schema: { type: 'integer' } },
          { name: 'montoMin', in: 'query', schema: { type: 'number' } },
          { name: 'montoMax', in: 'query', schema: { type: 'number' } },
          { name: 'estado', in: 'query', schema: { type: 'string', enum: ['ACTIVO', 'INACTIVO'] } },
        ],
        responses: {
          200: {
            description: 'Resumen y transacciones filtradas',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    count: { type: 'integer' }, countIngresos: { type: 'integer' }, countEgresos: { type: 'integer' },
                    totalIngresos: { type: 'number' }, totalEgresos: { type: 'number' }, balance: { type: 'number' },
                    rows: { type: 'array', items: { $ref: '#/components/schemas/Transaccion' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/reportes/corte': {
      get: {
        tags: ['Reportes y Consultas'],
        summary: 'Reporte de cortes entre fechas y por usuario',
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: 'desde', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'hasta', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'usuarioId', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Cortes con totales y cantidad de transacciones' } },
      },
    },
    '/api/reportes/dashboard': {
      get: {
        tags: ['Reportes y Consultas'],
        summary: 'Resumen financiero para el dashboard (balance, límite, % uso, último corte)',
        security: [{ cookieAuth: [] }],
        responses: {
          200: {
            description: 'Resumen del usuario autenticado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    mes: { type: 'object' }, totales: { type: 'object' },
                    limite: { type: ['number', 'null'] }, superaLimite: { type: 'boolean' },
                    pctUso: { type: ['number', 'null'] },
                    ultimoCorte: { $ref: '#/components/schemas/Corte' },
                    porCategoria: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

module.exports = spec;