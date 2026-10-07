# SHUGOGEO · Gestión de Empleados y Operatividad

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
.venv/bin/python manage.py cargar_demo        # OPCIONAL: 12 agentes ficticios, licencias, patrimonio, servicios + usuarios admin/consulta
.venv/bin/python manage.py runserver          # http://127.0.0.1:8000  (API docs: /api/docs/)

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev                                   # http://localhost:5173  (redirige /api al backend)
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
La documentación respaldatoria y las planillas de cargo se guardan en el volumen `media` y **sólo se descargan por la API autenticada**
(nginx no expone ninguna carpeta de media).
La base de Docker (PostgreSQL) es independiente de la de desarrollo (SQLite): la primera vez hay que crear el usuario
(`createsuperuser`) o cargar la demo (`docker compose exec backend python manage.py cargar_demo`).
Los respaldos automáticos quedaron fuera de esta etapa (el volumen `pgdata` se puede respaldar con `pg_dump`).

---

## Conceptos clave del dominio

| Concepto | Descripción |
|---|---|
| **Estructura organizativa** | Árbol de **unidades**: Dirección General › Direcciones › Áreas (Configuración › Estructura organizativa). En una instalación nueva sólo existe la Dirección General (con el nombre de `SHUGO_ORGANISMO`): las direcciones y áreas las crea el administrador, y los reinicios del contenedor no las modifican. Cada empleado se asigna a **cualquier unidad**, de cualquier nivel (p. ej. personal de la Dirección General sin área). Filtrar por una unidad incluye a todo el personal de sus dependientes. Para sumar un nivel (Departamento, División) se agrega a `TipoUnidad` en `apps/organizacion/models.py`. |
| **Situación de revista** | Estado administrativo cargado a mano: Activo / Suspendido / Baja (baja lógica, se conserva el historial). |
| **Licencia (novedad)** | Período de un empleado con un artículo de licencia (vacaciones, licencia médica, ausencia…). Puede quedar **abierta** (sin fecha de fin) si el artículo lo permite. |
| **Estado del día** | **No se guarda: se calcula** a partir de las novedades vigentes en la fecha. Sin novedades = Activo. Si hay varias superpuestas se muestran todas. |
| **Artículo de licencia** | Configurable (Configuración › Artículos de licencia): **color** (con el que se ve el agente en el Inicio y el calendario), cómputo (días hábiles/corridos), si descuenta saldo, si requiere documentación, si puede quedar abierta. En el código es el modelo `TipoNovedad`. Un agente está **trabajando** si no tiene ninguna licencia vigente. |
| **Saldo** | Libro de movimientos por empleado y tipo: asignaciones (manuales o masivas) + compensaciones por día no laborable trabajado ± ajustes − días de licencias registradas. **Es acumulable** entre años. Un artículo con **"Saldo por año"** tiene una bolsa independiente por año: cada asignación (individual o masiva) va al año indicado y al registrar una licencia se elige de qué año se descuenta (los años no vencen). Los días se descuentan **al registrar** la licencia (utilizados si ya empezó, programados si es futura). Sólo descuentan los tipos con "Descuenta saldo". Un tipo puede **usar el saldo de otro** (Licencia invernal → Licencia vacaciones): sus acreditaciones suman a esa bolsa y sus licencias descuentan de ella; el saldo muestra el desglose por tipo. Cada bolsa se puede **ocultar** ("Mostrar saldo") cuando ya no se usa; la ficha muestra una fila por bolsa y el **total general**. "Ver uso" (Configuración › Artículos de licencia) lista quién tiene días o licencias de un artículo; las licencias anuladas no impiden eliminarlo (se borran con él). En la ficha, "Elegir visibles" define por empleado qué bolsas se muestran y suman al total. "Acreditar a todos" (y la propuesta al crear un tipo con saldo) hace la carga masiva de días. |
| **Interrupción** | Acción "Interrumpir" sobre una licencia: se indica el último día tomado, se recalculan los días y **los no tomados vuelven al saldo**. Quedan registrados la fecha de fin prevista, los días originales y el motivo. |
| **Estado de la licencia** | Se calcula: Programada · En curso · Finalizada · Interrumpida · Anulada. **Sólo se eliminan las programadas o las cargadas hoy** (corrección inmediata de un error). En curso: sólo se extiende la fecha de fin (acortar = Interrumpir). Finalizadas/interrumpidas: sólo motivo, observaciones y documentación. |
| **Anulación** | Reemplaza al borrado para licencias cargadas por error: motivo obligatorio, se registra quién y cuándo, el registro queda en el historial y **sus días vuelven al saldo**. Las anuladas no cuentan en saldos, Inicio, calendario ni reportes. |
| **Día no laborable** | Feriados (carga inicial automática de los nacionales), asuetos y días otorgados por resolución, con motivo y norma. Se descuentan del cómputo de días hábiles y se ven en el calendario. |
| **Legajo** | Único. Las modalidades con "usa DNI como legajo" (contratos, pasantes) lo completan con el DNI si se deja vacío. |
| **Cargo patrimonial** | Bienes a cargo de cada agente: insumo (catálogo configurable), planilla de cargo, IUB, descripción y legajo del responsable al momento de la asignación. IUB y planilla son obligatorios. Se cierran con **Transferir** (a otro empleado: nuevo cargo con el mismo IUB y una planilla nueva y distinta; o a un área ajena a Informática: queda sin agente) o **Dar de baja** (fuera de servicio: el IUB no puede volver a asignarse). Cada cargo guarda sus **archivos** (planilla firmada, actas): se adjuntan al asignar, al transferir (van al cargo nuevo; la planilla anterior queda como referencia en el cerrado) o al dar de baja, y se ven (imágenes y PDF, con el visor integrado) o descargan sólo por la API autenticada. Todo queda en el historial y buscar por IUB muestra la trayectoria del bien. Un IUB no puede estar a cargo de dos personas y no se puede dar de baja a un agente con bienes a cargo. |

---

## Arquitectura

```
Shugo-GEO/
├── backend/
│   ├── config/                 settings (base/dev/prod), urls raíz
│   └── apps/
│       ├── core/               modelos base, permisos, paginación, fechas, comandos inicializar/cargar_demo
│       ├── accounts/           usuario, roles (grupos Django), JWT, /auth/me
│       ├── organizacion/       estructura organizativa (árbol de unidades), modalidades
│       ├── personal/           empleados, ficha, filtros comunes (selectors.py)
│       ├── calendario/         feriados/asuetos, cómputo de días hábiles, eventos del calendario
│       ├── novedades/          artículos de licencia, licencias, documentación respaldatoria
│       ├── vacaciones/         movimientos de saldo, cálculo de saldos, asignación masiva
│       ├── patrimonio/         cargo patrimonial: tipos de insumo, bienes a cargo, bajas y transferencias
│       ├── servicios/          líneas móviles e internet, con proveedores, tipos de SIM y estados de línea
│       ├── dashboard/          Inicio: estado del personal (resumen + tabla) y grilla por período
│       └── reportes/           registro de reportes + exportación genérica Excel/PDF
└── frontend/src/
    ├── app/                    App, providers, router (generado desde los módulos), tema
    ├── core/                   infraestructura sin lógica de negocio: cliente API, auth, layout, CrudPage, hooks
    ├── shared/                 API de entidades y componentes de dominio reutilizables (selects, formularios)
    └── modules/                una carpeta por funcionalidad, cada una exporta un AppModule
        ├── dashboard/ (Inicio, incluye el calendario) personal/ novedades/ vacaciones/ patrimonio/ servicios/ reportes/ configuracion/
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
| B. Gestión de vacaciones (días, período, usados, disponibles, historial, calendario, cálculo automático) | Estado de licencias · Ficha · Inicio › Calendario |
| C. Ausencias y licencias (tipo, motivo, período, observaciones, documentación, tipos configurables) | Licencias del personal · Configuración › Artículos de licencia |
| 7. Dashboard (totales por estado, estado por empleado con desde/hasta, filtros por unidad, modalidad, estado, período y empleado) | Inicio: tarjetas por dirección (ícono y línea con el color del estado), tabla, vista por período y calendario |
| 8. Ficha individual (datos, situación actual, historial) | Personal › ficha |
| 9. Calendario general | Inicio › Calendario: vista Mes (nombre de quienes faltan cada día con el color de su licencia, tinte según % de ausentes, detalle por día) y Lista; el cronograma agente × día es la Vista por período. Las novedades abiertas no se proyectan después de hoy. |
| 10. Roles y permisos | Administrador / Consulta (extensible) |
| 11. Reportes Excel/PDF (nómina, activos, ausentes en fecha, vacaciones por período, licencias, historial, por área, por modalidad, saldos) | Reportes |
| 12. Historial de modificaciones, búsquedas, filtros, seguridad | django-simple-history, filtros en todas las pantallas, JWT + permisos |

### Funcionalidades agregadas fuera del requerimiento original

| Funcionalidad | Dónde |
|---|---|
| Estructura en árbol (Dirección General › Direcciones › Áreas) | Configuración › Estructura organizativa |
| Bolsas de saldo compartidas, ocultar bolsas, elegir visibles por empleado, acreditación masiva | Configuración › Artículos de licencia · Ficha › Saldos · Estado de licencias |
| Interrupción, anulación e historial de licencias | Licencias del personal · Ficha |
| Cargo patrimonial (insumos, planillas, IUB, transferencias, bajas) | Cargos patrimoniales · Ficha › Bienes a cargo · Reporte "Cargos patrimoniales" |
| Servicios contratados: líneas móviles (número, SIM, proveedor, estado, responsable, área, secretaría) e internet (sitio, dirección, proveedor, cliente, FSAN, velocidad, IP pública) | Servicios · Configuración › Categoría de servicios |

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
