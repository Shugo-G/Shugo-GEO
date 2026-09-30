"""
Definición de los reportes disponibles.

Cubren los reportes solicitados en el requerimiento (punto 11):
nómina, personal activo, ausentes en una fecha, vacaciones por período,
licencias, historial de ausencias, reporte por dirección/unidad y por modalidad.
"""
from collections import Counter

from apps.core.fechas import hoy, parse_fecha_param
from apps.dashboard.services import estado_personal
from apps.novedades.models import Novedad, TipoNovedad
from apps.organizacion.selectors import Arbol
from apps.personal.selectors import filtrar_empleados
from apps.vacaciones.services import bolsas_de_saldo, saldos_por_empleado

from .base import Columna, Filtro, Reporte, registrar
from .utils import ids

# ---------------------------------------------------------------------------
# Personal
# ---------------------------------------------------------------------------


@registrar
class NominaPersonal(Reporte):
    clave = "nomina"
    titulo = "Nómina de personal"
    descripcion = "Listado del personal con sus datos laborales y de contacto. Filtrable por área, modalidad y situación."
    grupo = "Personal"
    filtros = [Filtro("unidad"), Filtro("modalidad"), Filtro("situacion_revista")]

    def columnas(self, params):
        return [
            Columna("legajo", "Legajo", 10),
            Columna("nombre", "Apellido y nombre", 28),
            Columna("dni", "DNI", 11),
            Columna("unidad", "Unidad organizativa", 32),
            Columna("modalidad", "Modalidad", 18),
            Columna("fecha_ingreso", "Ingreso", 11, "fecha"),
            Columna("fecha_fin_contrato", "Fin contrato", 11, "fecha"),
            Columna("telefono", "Teléfono", 14),
            Columna("email", "Email", 24),
            Columna("situacion", "Situación", 11),
        ]

    def filas(self, params):
        empleados = filtrar_empleados(params, solo_vigentes=False)
        arbol = Arbol()
        return [
            {
                "legajo": e.legajo,
                "nombre": e.nombre_completo,
                "dni": e.dni,
                "unidad": arbol.ruta(e.unidad_id),
                "modalidad": e.modalidad.nombre,
                "fecha_ingreso": e.fecha_ingreso,
                "fecha_fin_contrato": e.fecha_fin_contrato,
                "telefono": e.telefono,
                "email": e.email,
                "situacion": e.get_situacion_revista_display(),
            }
            for e in empleados
        ]


class _EstadoEnFecha(Reporte):
    """Base: estado de cada empleado en una fecha (usa el mismo cálculo que el dashboard)."""

    grupo = "Estado del personal"
    filtros = [Filtro("fecha", requerido=True, multiple=False), Filtro("unidad"), Filtro("modalidad")]
    solo_trabajando: bool | None = None  # None = todos

    def columnas(self, params):
        return [
            Columna("legajo", "Legajo", 10),
            Columna("nombre", "Apellido y nombre", 28),
            Columna("unidad", "Unidad organizativa", 32),
            Columna("modalidad", "Modalidad", 18),
            Columna("estado", "Estado", 26),
            Columna("desde", "Desde", 11, "fecha"),
            Columna("hasta", "Hasta", 11, "fecha"),
        ]

    def filas(self, params):
        fecha = parse_fecha_param(params.get("fecha"), "fecha", hoy()).isoformat()
        datos = estado_personal({**params, "desde": fecha, "hasta": fecha})
        filas = []
        for emp in datos["empleados"]:
            if self.solo_trabajando is not None and emp["trabajando"] != self.solo_trabajando:
                continue
            base = {
                "legajo": emp["legajo"],
                "nombre": emp["nombre"],
                "unidad": emp["unidad_ruta"],
                "modalidad": emp["modalidad"],
            }
            if not emp["novedades"]:
                filas.append({**base, "estado": "Activo", "desde": None, "hasta": None})
            for n in emp["novedades"]:
                filas.append({**base, "estado": n["tipo"], "desde": n["desde"], "hasta": n["hasta"]})
        return filas


@registrar
class EstadoPersonalFecha(_EstadoEnFecha):
    clave = "estado_fecha"
    titulo = "Estado del personal en una fecha"
    descripcion = "Situación de cada agente (activo, vacaciones, licencia, ausente...) en la fecha indicada."


@registrar
class PersonalTrabajandoFecha(_EstadoEnFecha):
    clave = "activos_fecha"
    titulo = "Personal activo en una fecha"
    descripcion = "Agentes trabajando (sin licencias vigentes) en la fecha indicada."
    solo_trabajando = True


@registrar
class PersonalAusenteFecha(_EstadoEnFecha):
    clave = "ausentes_fecha"
    titulo = "Personal ausente en una fecha"
    descripcion = "Agentes que no están trabajando en la fecha indicada, con el motivo y período."
    solo_trabajando = False


class _ResumenPor(Reporte):
    """Base: cantidad de agentes por grupo (área o modalidad) y estado en una fecha."""

    grupo = "Estado del personal"
    filtros = [Filtro("fecha", requerido=True, multiple=False), Filtro("unidad"), Filtro("modalidad")]
    campo_grupo = ""
    etiqueta_grupo = ""

    def _articulos(self):
        return list(TipoNovedad.objects.filter(activo=True))

    def columnas(self, params):
        return [
            Columna("grupo", self.etiqueta_grupo, 24),
            Columna("total", "Total", 8, "numero"),
            Columna("trabajando", "Trabajando", 11, "numero"),
            *[Columna(f"tipo_{t.id}", t.nombre, 12, "numero") for t in self._articulos()],
        ]

    def filas(self, params):
        fecha = parse_fecha_param(params.get("fecha"), "fecha", hoy()).isoformat()
        datos = estado_personal({**params, "desde": fecha, "hasta": fecha})
        grupos: dict[str, Counter] = {}
        for emp in datos["empleados"]:
            contador = grupos.setdefault(emp[self.campo_grupo], Counter())
            contador["total"] += 1
            contador["trabajando"] += emp["trabajando"]
            for tipo_id in {n["tipo_id"] for n in emp["novedades"]}:
                contador[f"tipo_{tipo_id}"] += 1
        claves = [c.clave for c in self.columnas(params)][1:]
        filas = [{"grupo": nombre, **{k: contador.get(k, 0) for k in claves}} for nombre, contador in sorted(grupos.items())]
        if filas:
            filas.append({"grupo": "TOTAL", **{k: sum(f[k] for f in filas) for k in claves}})
        return filas


@registrar
class ResumenPorDireccion(_ResumenPor):
    clave = "resumen_direccion"
    titulo = "Reporte por dirección"
    descripcion = (
        "Cantidad de agentes por dirección (incluye sus áreas) y su estado en la fecha indicada. "
        "Quienes dependen directamente de la Dirección General se agrupan en ella."
    )
    campo_grupo = "direccion"
    etiqueta_grupo = "Dirección"


@registrar
class ResumenPorUnidad(_ResumenPor):
    clave = "resumen_unidad"
    titulo = "Reporte por unidad organizativa"
    descripcion = "Cantidad de agentes por unidad (Dirección General, dirección o área) y su estado en la fecha indicada."
    campo_grupo = "unidad_ruta"
    etiqueta_grupo = "Unidad organizativa"


@registrar
class ResumenPorModalidad(_ResumenPor):
    clave = "resumen_modalidad"
    titulo = "Reporte por modalidad de contratación"
    descripcion = "Cantidad de agentes por modalidad y su estado en la fecha indicada."
    campo_grupo = "modalidad"
    etiqueta_grupo = "Modalidad"


# ---------------------------------------------------------------------------
# Novedades
# ---------------------------------------------------------------------------


class _Novedades(Reporte):
    grupo = "Licencias del personal"
    permisos = ("personal.view_empleado", "novedades.view_novedad")
    filtros = [
        Filtro("periodo", requerido=True),
        Filtro("tipo_novedad"),
        Filtro("unidad"),
        Filtro("modalidad"),
        Filtro("empleado"),
    ]
    solo_con_saldo = False

    def columnas(self, params):
        return [
            Columna("legajo", "Legajo", 10),
            Columna("empleado", "Apellido y nombre", 26),
            Columna("unidad", "Unidad", 22),
            Columna("tipo", "Artículo", 20),
            Columna("desde", "Desde", 11, "fecha"),
            Columna("hasta", "Hasta", 11, "fecha"),
            Columna("dias", "Días", 7, "numero"),
            Columna("motivo", "Motivo", 30),
        ]

    def queryset(self, params):
        qs = Novedad.objects.con_relaciones().order_by("empleado__apellido", "empleado__nombre", "fecha_desde")
        desde = parse_fecha_param(params.get("desde"), "desde")
        hasta = parse_fecha_param(params.get("hasta"), "hasta")
        if desde and hasta:
            qs = qs.en_periodo(desde, hasta)
        empleados = filtrar_empleados(params, solo_vigentes=False)
        qs = qs.filter(empleado__in=empleados)
        if tipos := ids(params.get("tipo_novedad")):
            qs = qs.filter(tipo_id__in=tipos)
        if self.solo_con_saldo:
            qs = qs.filter(tipo__descuenta_saldo=True)
        return qs

    def filas(self, params):
        arbol = Arbol()
        return [
            {
                "legajo": n.empleado.legajo,
                "empleado": n.empleado.nombre_completo,
                "unidad": arbol.ruta(n.empleado.unidad_id),
                "tipo": n.tipo.nombre,
                "desde": n.fecha_desde,
                "hasta": n.fecha_hasta,
                "dias": n.dias,
                "motivo": n.motivo,
            }
            for n in self.queryset(params)
        ]


@registrar
class VacacionesPorPeriodo(_Novedades):
    clave = "vacaciones_periodo"
    titulo = "Vacaciones por período"
    descripcion = "Períodos de vacaciones (tipos que descuentan saldo) que se superponen con el período indicado."
    solo_con_saldo = True
    filtros = [Filtro("periodo", requerido=True), Filtro("unidad"), Filtro("modalidad"), Filtro("empleado")]


@registrar
class NovedadesPorPeriodo(_Novedades):
    clave = "novedades_periodo"
    titulo = "Licencias por período"
    descripcion = "Todas las licencias del período, filtrables por artículo, unidad, modalidad o empleado."


@registrar
class HistorialEmpleado(_Novedades):
    clave = "historial_empleado"
    titulo = "Historial de ausencias por empleado"
    descripcion = "Historial completo de vacaciones, licencias y ausencias de uno o más empleados."
    filtros = [Filtro("empleado", requerido=True), Filtro("periodo"), Filtro("tipo_novedad")]


@registrar
class SaldosVacaciones(Reporte):
    clave = "saldos"
    titulo = "Saldos de licencias"
    descripcion = "Días asignados, compensados, utilizados, programados y disponibles por empleado."
    grupo = "Licencias del personal"
    permisos = ("personal.view_empleado", "vacaciones.view_movimientosaldo")
    filtros = [Filtro("tipo_saldo"), Filtro("unidad"), Filtro("modalidad"), Filtro("empleado")]

    def columnas(self, params):
        return [
            Columna("legajo", "Legajo", 10),
            Columna("empleado", "Apellido y nombre", 26),
            Columna("unidad", "Unidad", 22),
            Columna("tipo", "Bolsa de días", 26),
            Columna("asignados", "Asignados", 10, "numero"),
            Columna("compensados", "Compensados", 12, "numero"),
            Columna("ajustes", "Ajustes", 9, "numero"),
            Columna("usados", "Utilizados", 10, "numero"),
            Columna("programados", "Programados", 12, "numero"),
            Columna("disponible", "Disponibles", 11, "numero"),
        ]

    def filas(self, params):
        empleados = list(filtrar_empleados(params))
        tipo_ids = ids(params.get("tipo_saldo"))
        # Sin tipo elegido se omiten las bolsas ocultas; si se eligen explícitamente, se incluyen.
        bolsas = bolsas_de_saldo(TipoNovedad.objects.filter(id__in=tipo_ids) if tipo_ids else None, incluir_ocultas=bool(tipo_ids))
        saldos = saldos_por_empleado([e.id for e in empleados], bolsas)
        arbol = Arbol()
        numericos = ("asignados", "compensados", "ajustes", "usados", "programados", "disponible")
        filas = []
        for e in empleados:
            base = {"legajo": e.legajo, "empleado": e.nombre_completo, "unidad": arbol.ruta(e.unidad_id)}
            propias = list(saldos[e.id].values())
            for saldo in propias:
                filas.append({**base, **{k: saldo[k] for k in numericos}, "tipo": " + ".join([saldo["tipo"], *saldo["incluye"]])})
            if len(propias) > 1:
                filas.append({**base, **{k: sum(s[k] for s in propias) for k in numericos}, "tipo": "TOTAL"})
        return filas



# ---------------------------------------------------------------------------
# Patrimonio
# ---------------------------------------------------------------------------


@registrar
class CargosPatrimoniales(Reporte):
    clave = "cargos_patrimoniales"
    titulo = "Cargos patrimoniales"
    descripcion = "Bienes a cargo del personal (o historial de bajas y transferencias), con planilla, IUB y legajo."
    grupo = "Cargos patrimoniales"
    permisos = ("patrimonio.view_cargopatrimonial",)
    filtros = [Filtro("situacion_cargo", multiple=False), Filtro("tipo_insumo"), Filtro("unidad"), Filtro("empleado")]

    def columnas(self, params):
        return [
            Columna("insumo", "Insumo", 16),
            Columna("iub", "IUB", 14),
            Columna("planilla", "Planilla de cargo", 14),
            Columna("descripcion", "Descripción", 28),
            Columna("legajo", "Legajo", 10),
            Columna("empleado", "Responsable", 24),
            Columna("unidad", "Unidad", 22),
            Columna("asignacion", "Asignado", 11, "fecha"),
            Columna("cierre", "Cierre", 11, "fecha"),
            Columna("estado", "Estado / destino", 26),
        ]

    def filas(self, params):
        from apps.patrimonio.models import CargoPatrimonial

        qs = CargoPatrimonial.objects.con_relaciones().order_by("tipo_insumo__nombre", "empleado__apellido", "fecha_asignacion")
        situacion = params.get("situacion_cargo") or "vigentes"
        if situacion == "vigentes":
            qs = qs.vigentes()
        elif situacion == "historial":
            qs = qs.filter(fecha_cierre__isnull=False)
        if insumos := ids(params.get("tipo_insumo")):
            qs = qs.filter(tipo_insumo_id__in=insumos)
        empleados = filtrar_empleados(params, solo_vigentes=False)
        qs = qs.filter(empleado__in=empleados)
        arbol = Arbol()
        return [
            {
                "insumo": c.tipo_insumo.nombre,
                "iub": c.iub,
                "planilla": c.planilla_cargo,
                "descripcion": c.descripcion,
                "legajo": c.legajo,
                "empleado": c.empleado.nombre_completo,
                "unidad": arbol.ruta(c.empleado.unidad_id),
                "asignacion": c.fecha_asignacion,
                "cierre": c.fecha_cierre,
                "estado": "A cargo" if c.vigente else f"{c.get_tipo_cierre_display()}{f' → {c.destino}' if c.destino else ''}",
            }
            for c in qs
        ]
