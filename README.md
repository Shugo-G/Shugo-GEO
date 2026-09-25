# Shugo-GEO · Gestión de Empleados y Operatividad

Sistema de gestión y control de personal para la **Dirección General de Informática — Municipalidad de Ushuaia**.

- **Backend:** Python 3.12 · Django 5.2 · Django REST Framework · JWT · PostgreSQL
- **Frontend:** React 18 · TypeScript · Vite · Ant Design 5 · TanStack Query · FullCalendar
- **Despliegue:** Docker Compose (PostgreSQL + gunicorn + nginx)

---

## Puesta en marcha (desarrollo)

```bash
# Backend (SQLite por defecto; para PostgreSQL definir DATABASE_URL)
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements/dev.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py inicializar        # roles, catálogos iniciales y feriados nacionales
.venv/bin/python manage.py cargar_demo        # OPCIONAL: datos ficticios + usuarios admin/consulta
.venv/bin/python manage.py runserver          # http://127.0.0.1:8000  (API docs: /api/docs/)

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev                                   # http://localhost:5173  (redirige /api y /media/fotos al backend)
```

**Mostrar la app a otra PC de la red:** `npm run dev:red` (Vite escucha en `0.0.0.0`) y abrir el puerto en el firewall,
p. ej. `sudo ufw allow from 172.20.0.0/16 to any port 5173 proto tcp`. Desde la otra PC: `http://<IP-de-esta-PC>:5173`.

Usuarios de la demo: `admin / Admin.2026` (Administrador) y `consulta / Consulta.2026` (Consulta).
Sin demo, crear el primer administrador con `python manage.py createsuperuser`.

Tests del backend: `.venv/bin/python manage.py test apps`
Chequeo de tipos del frontend: `npm run typecheck`

## Despliegue (producción)

```bash
cp .env.example .env      # completar claves, hosts y datos del organismo
docker compose up -d --build
docker compose exec backend python manage.py createsuperuser
```

nginx publica el puerto `HTTP_PORT` (80 por defecto), sirve el frontend y redirige `/api` y `/admin` a Django.
La documentación respaldatoria y las fotos se guardan en el volumen `media`: nginx sirve públicamente **sólo** `media/fotos/`;
la documentación **sólo se descarga por la API autenticada**.
La base de Docker (PostgreSQL) es independiente de la de desarrollo (SQLite): la primera vez hay que crear el usuario
(`createsuperuser`) o cargar la demo (`docker compose exec backend python manage.py cargar_demo`).
Los respaldos automáticos quedaron fuera de esta etapa (el volumen `pgdata` se puede respaldar con `pg_dump`).

---

## Conceptos clave del dominio

| Concepto | Descripción |
|---|---|
| **Estructura organizativa** | Árbol de **unidades**: Dirección General › Direcciones › Áreas (Configuración › Estructura organizativa). Cada empleado se asigna a **cualquier unidad**, de cualquier nivel (p. ej. personal de la Dirección General sin área). Filtrar por una unidad incluye a todo el personal de sus dependientes. Para sumar un nivel (Departamento, División) se agrega a `TipoUnidad` en `apps/organizacion/models.py`. |
| **Situación de revista** | Estado administrativo cargado a mano: Activo / Suspendido / Baja (baja lógica, se conserva el historial). |
| **Novedad** | Período de un empleado con un tipo (vacaciones, licencia, ausencia, comisión…). Puede quedar **abierta** (sin fecha de fin) si el tipo lo permite. |
| **Estado del día** | **No se guarda: se calcula** a partir de las novedades vigentes en la fecha. Sin novedades = Activo. Si hay varias superpuestas se muestran todas. |
| **Tipo de novedad** | Configurable: categoría, color, cómputo (días hábiles/corridos), si descuenta saldo, si requiere documentación, si puede quedar abierta. |
| **Categoría de estado** | Agrupa tipos en las tarjetas del dashboard. `cuenta_como_presente` hace que el agente sume en "Trabajando" (p. ej. Comisión). |
| **Saldo** | Libro de movimientos por empleado y tipo: asignaciones (manuales o masivas) + compensaciones por día no laborable trabajado ± ajustes − días de licencias registradas. **Es acumulable** entre años. Los días se descuentan **al registrar** la licencia (utilizados si ya empezó, programados si es futura). Sólo descuentan los tipos con "Descuenta saldo". Un tipo puede **usar el saldo de otro** (Licencia invernal → Licencia vacaciones): sus acreditaciones suman a esa bolsa y sus licencias descuentan de ella; el saldo muestra el desglose por tipo. Cada bolsa se puede **ocultar** ("Mostrar saldo") cuando ya no se usa; la ficha muestra una tabla con subtotal por categoría y **total general**. "Ver uso" (Configuración › Tipos) lista quién tiene días o licencias de un tipo; las licencias anuladas no impiden eliminarlo (se borran con él). En la ficha, "Elegir visibles" define por empleado qué bolsas se muestran y suman al total. "Acreditar a todos" (y la propuesta al crear un tipo con saldo) hace la carga masiva de días. |
| **Interrupción** | Acción "Interrumpir" sobre una licencia: se indica el último día tomado, se recalculan los días y **los no tomados vuelven al saldo**. Quedan registrados la fecha de fin prevista, los días originales y el motivo. |
| **Estado de la licencia** | Se calcula: Programada · En curso · Finalizada · Interrumpida · Anulada. **Sólo se eliminan las programadas o las cargadas hoy** (corrección inmediata de un error). En curso: sólo se extiende la fecha de fin (acortar = Interrumpir). Finalizadas/interrumpidas: sólo motivo, observaciones y documentación. |
| **Anulación** | Reemplaza al borrado para licencias cargadas por error: motivo obligatorio, se registra quién y cuándo, el registro queda en el historial y **sus días vuelven al saldo**. Las anuladas no cuentan en saldos, dashboard, calendario ni reportes. |
| **Día no laborable** | Feriados (carga inicial automática de los nacionales), asuetos y días otorgados por resolución, con motivo y norma. Se descuentan del cómputo de días hábiles y se ven en el calendario. |
| **Legajo** | Único. Las modalidades con "usa DNI como legajo" (contratos, pasantes) lo completan con el DNI si se deja vacío. |
| **Foto** | Se carga desde la ficha; el servidor la recorta cuadrada, la reduce a 400 px y la guarda como JPEG con nombre aleatorio. Sin foto se muestra `frontend/public/avatar-placeholder.png`. Sólo la carpeta `media/fotos/` se sirve públicamente (nginx); la documentación respaldatoria nunca. |
| **Cargo patrimonial** | Bienes a cargo de cada agente: insumo (catálogo configurable), planilla de cargo, IUB, descripción y legajo del responsable al momento de la asignación. IUB y planilla son obligatorios. Se cierran con **Transferir** (a otro empleado: nuevo cargo con el mismo IUB y una planilla nueva y distinta; o a un área ajena a Informática: queda sin agente) o **Dar de baja** (fuera de servicio: el IUB no puede volver a asignarse). Todo queda en el historial y buscar por IUB muestra la trayectoria del bien. Un IUB no puede estar a cargo de dos personas y no se puede dar de baja a un agente con bienes a cargo. |

---

## Arquitectura

```
Shugo-GEO/
├── backend/
│   ├── config/                 settings (base/dev/prod), urls raíz
│   └── apps/
│       ├── core/               modelos base, permisos, paginación, fechas, comandos inicializar/cargar_demo
│       ├── accounts/           usuario, roles (grupos Django), JWT, /auth/me
│       ├── organizacion/       estructura organizativa (árbol de unidades), puestos, modalidades
│       ├── personal/           empleados, ficha, filtros comunes (selectors.py)
│       ├── calendario/         feriados/asuetos, cómputo de días hábiles, eventos del calendario
│       ├── novedades/          categorías, tipos, novedades, documentación respaldatoria
│       ├── vacaciones/         movimientos de saldo, cálculo de saldos, asignación masiva
│       ├── patrimonio/         cargo patrimonial: tipos de insumo, bienes a cargo, bajas y transferencias
│       ├── dashboard/          estado del personal (resumen + tabla) y grilla por período
│       └── reportes/           registro de reportes + exportación genérica Excel/PDF
└── frontend/src/
    ├── app/                    App, providers, router (generado desde los módulos), tema
    ├── core/                   infraestructura sin lógica de negocio: cliente API, auth, layout, CrudPage, hooks
    ├── shared/                 API de entidades y componentes de dominio reutilizables (selects, formularios)
    └── modules/                una carpeta por funcionalidad, cada una exporta un AppModule
        ├── dashboard/ personal/ novedades/ vacaciones/ calendario/ patrimonio/ reportes/ configuracion/
        ├── types.ts            contrato AppModule (menú + rutas + permisos)
        └── index.ts            registro de módulos
```

### Convenciones del backend (por app)

- `models.py` datos · `serializers.py` validación de entrada/salida · `views.py` endpoints delgados
- `services.py` reglas de negocio que escriben · `selectors.py` consultas reutilizables
- `seeds.py` datos iniciales (idempotente) · `tests.py`
- Todos los modelos de negocio registran **historial de cambios** (`django-simple-history`), visible en la ficha y en cada catálogo.

### Permisos

Los roles son **grupos de Django** con permisos de modelo (`view/add/change/delete`). La API los aplica automáticamente
(`apps/core/permissions.py`) y el frontend recibe la lista en `/api/auth/me/` para mostrar u ocultar menús y botones.

- **Administrador:** todo.
- **Consulta:** sólo lectura; no ve documentación respaldatoria ni usuarios.

**Crear un rol nuevo** (p. ej. "Jefe de área") no requiere código: se crea el grupo en `/admin/` y se le asignan permisos,
o se agrega a `ROLES` en `apps/accounts/roles.py` y se ejecuta `manage.py inicializar`.

---

## Cómo extender el sistema

### Agregar un módulo nuevo

**Backend**
1. `python manage.py startapp <nombre> apps/<nombre>` y ajustar `apps.py` (`name = "apps.<nombre>"`).
2. Sumarlo a `LOCAL_APPS` en `config/settings/base.py`.
3. Registrar sus urls en `API_MODULES` de `config/urls.py`.
4. Si maneja permisos para los roles existentes, sumarlo a `APPS_NEGOCIO` en `apps/accounts/roles.py` y correr `inicializar`.

**Frontend**
1. Crear `src/modules/<nombre>/` con `pages/`, `components/`, `api.ts`.
2. Exportar desde `index.tsx` un `AppModule` con su menú, rutas y permisos.
3. Agregarlo al array de `src/modules/index.ts`. El menú lateral y las rutas se generan solos.

### Agregar un catálogo configurable
Backend: modelo que herede de `CatalogoBase`, serializer de `CatalogoSerializer`, viewset de `CatalogoViewSet`.
Frontend: `crearRecurso<T>('ruta')` en `shared/api/catalogos.ts` y una pantalla `<CrudPage campos=[...]/>` en `modules/configuracion/pages/catalogos.tsx`.

### Agregar un reporte
Crear una clase en `backend/apps/reportes/definiciones.py` con `@registrar`, definiendo `clave`, `titulo`, `filtros`,
`columnas()` y `filas()`. Aparece sola en la pantalla de Reportes con su formulario de filtros y exportación a Excel/PDF.

### Cambiar la identidad visual
Colores en `frontend/src/app/theme.ts` y `global.css` (`--color-primario`), logo en `frontend/public/logo.svg`,
y el nombre del organismo/municipio con `SHUGO_ORGANISMO` / `SHUGO_MUNICIPIO` (se usa en pantallas y reportes).

---

## Cobertura del requerimiento

| Punto del requerimiento | Dónde |
|---|---|
| A. Registro de personal (ficha, modalidad configurable) | Personal · Configuración › Modalidades |
| B. Gestión de vacaciones (días, período, usados, disponibles, historial, calendario, cálculo automático) | Vacaciones y saldos · Ficha · Calendario |
| C. Ausencias y licencias (tipo, motivo, período, observaciones, documentación, tipos configurables) | Licencias y ausencias · Configuración › Tipos |
| 7. Dashboard (totales por estado, estado por empleado con desde/hasta, filtros por unidad, modalidad, estado, período y empleado) | Dashboard: tarjetas por dirección (color según estado), tabla y grilla por período |
| 8. Ficha individual (datos, situación actual, historial) | Personal › ficha |
| 9. Calendario general | Calendario: vista Mes (nombre de quienes faltan cada día con el color de su licencia, tinte según % de ausentes, detalle por día), Cronograma (agente × día) y Lista. Las novedades abiertas no se proyectan después de hoy. |
| 10. Roles y permisos | Administrador / Consulta (extensible) |
| 11. Reportes Excel/PDF (nómina, activos, ausentes en fecha, vacaciones por período, licencias, historial, por área, por modalidad, saldos) | Reportes |
| 12. Historial de modificaciones, búsquedas, filtros, seguridad | django-simple-history, filtros en todas las pantallas, JWT + permisos |

### Funcionalidades agregadas fuera del requerimiento original

| Funcionalidad | Dónde |
|---|---|
| Estructura en árbol (Dirección General › Direcciones › Áreas) | Configuración › Estructura organizativa |
| Fotos de los agentes | Ficha (clic sobre la foto) · Dashboard |
| Bolsas de saldo compartidas, ocultar bolsas, elegir visibles por empleado, acreditación masiva | Configuración › Tipos · Ficha › Saldos · Vacaciones y saldos |
| Interrupción, anulación e historial de licencias | Licencias y ausencias · Ficha |
| Cargo patrimonial (insumos, planillas, IUB, transferencias, bajas) | Patrimonio · Ficha › Bienes a cargo · Reporte "Cargos patrimoniales" |

---

## Documentación técnica

En la raíz del proyecto hay documentos Word con el detalle técnico para quien tenga que mantener o ampliar el código:

| Documento | Contenido |
|---|---|
| `Shugo-GEO - 1 Arquitectura y despliegue.docx` | Stack, estructura de carpetas, flujo de una petición, configuración, Docker/nginx, seguridad, convenciones, cómo extender, tests |
| `Shugo-GEO - 2 Backend.docx` | Cada app de Django: modelos (campos), servicios y reglas, endpoints de la API, reportes, dependencias entre apps |
| `Shugo-GEO - 3 Frontend.docx` | Capas core/shared/modules, registro de módulos, cada pantalla y qué endpoints consume, componentes reutilizables |
| `Shugo-GEO - 4 Reglas de negocio y flujos.docx` | Estado del día, saldos y bolsas, ciclo de vida de licencias, patrimonio, calendario y dashboard paso a paso |

Se generan con el script de `docs/generador/` (`sh generar.sh`), que no se versiona: las tablas de modelos, endpoints y reportes se extraen del código.
