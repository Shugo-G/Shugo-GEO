"""
Estado del personal para el dashboard.

Un empleado está "trabajando" en una fecha si no tiene ninguna novedad vigente
cuya categoría implique ausencia (las categorías con `cuenta_como_presente`,
como Comisión/Afectación, no lo sacan de ese conteo). Si un empleado tiene
varias novedades superpuestas se muestran todas y cuenta en cada categoría.
"""
from collections import Counter

from apps.calendario.models import DiaNoLaborable
from apps.calendario.serializers import DiaNoLaborableSerializer
from apps.calendario.services import es_habil
from apps.core.fechas import es_fin_de_semana, hoy, parse_periodo, rango_fechas
from apps.novedades.models import CategoriaEstado
from apps.organizacion.selectors import Arbol
from apps.novedades.selectors import novedad_vigente_en, novedades_por_empleado, resumir_novedad
from apps.personal.selectors import filtrar_empleados

ESTADO_TRABAJANDO = "trabajando"
ESTADO_SIN_NOVEDAD = "sin_novedad"


def _empleados_del_periodo(params, hasta):
    return list(filtrar_empleados(params).filter(fecha_ingreso__lte=hasta))


def _fila_empleado(empleado, novedades, arbol: Arbol) -> dict:
    ausente = any(not n.tipo.categoria.cuenta_como_presente for n in novedades)
    return {
        "id": empleado.id,
        "legajo": empleado.legajo,
        "nombre": empleado.nombre_completo,
        "foto_url": empleado.foto.url if empleado.foto else None,
        "unidad_id": empleado.unidad_id,
        "unidad": empleado.unidad.nombre,
        "unidad_tipo": empleado.unidad.get_tipo_display(),
        "unidad_ruta": arbol.ruta(empleado.unidad_id),
        # Dirección a la que pertenece (o la Dirección General si depende directamente de ella).
        "direccion_id": (d := arbol.agrupador(empleado.unidad_id)) and d.id,
        "direccion": d.nombre if d else "",
        "modalidad_id": empleado.modalidad_id,
        "modalidad": empleado.modalidad.nombre,
        "trabajando": not ausente,
        "novedades": [resumir_novedad(n) for n in novedades],
    }


def _coincide_estado(fila: dict, estados: list[str]) -> bool:
    if not estados:
        return True
    categorias = {str(n["categoria_id"]) for n in fila["novedades"]}
    return (
        (ESTADO_TRABAJANDO in estados and fila["trabajando"])
        or (ESTADO_SIN_NOVEDAD in estados and not fila["novedades"])
        or bool(categorias.intersection(estados))
    )


def estado_personal(params) -> dict:
    """Resumen (tarjetas) y detalle por empleado para un día o un período."""
    desde, hasta = parse_periodo(params)
    empleados = _empleados_del_periodo(params, hasta)
    novedades = novedades_por_empleado(desde, hasta, [e.id for e in empleados])

    arbol = Arbol()
    filas = []
    por_categoria = Counter()
    trabajando = 0
    for empleado in empleados:
        fila = _fila_empleado(empleado, novedades.get(empleado.id, []), arbol)
        filas.append(fila)
        trabajando += fila["trabajando"]
        for categoria_id in {n["categoria_id"] for n in fila["novedades"]}:
            por_categoria[categoria_id] += 1

    estados = [e for e in (params.get("estado") or "").split(",") if e]
    categorias = CategoriaEstado.objects.filter(activo=True) | CategoriaEstado.objects.filter(id__in=por_categoria.keys())

    no_laborables = DiaNoLaborable.objects.filter(fecha__range=(desde, hasta))
    return {
        "desde": desde,
        "hasta": hasta,
        "es_un_dia": desde == hasta,
        "dia_habil": desde == hasta and es_habil(desde, {d.fecha for d in no_laborables}),
        "resumen": {
            "total": len(empleados),
            "trabajando": trabajando,
            "no_trabajando": len(empleados) - trabajando,
            "por_categoria": [
                {
                    "id": c.id,
                    "nombre": c.nombre,
                    "color": c.color,
                    "cuenta_como_presente": c.cuenta_como_presente,
                    "cantidad": por_categoria.get(c.id, 0),
                }
                for c in categorias.distinct().order_by("orden", "nombre")
            ],
        },
        "empleados": [f for f in filas if _coincide_estado(f, estados)],
        # Columnas de la vista por dirección, en el orden de la estructura.
        "grupos": [{"id": u.id, "nombre": u.nombre, "tipo": u.get_tipo_display()} for u in arbol.agrupadores()],
        "no_laborables": DiaNoLaborableSerializer(no_laborables, many=True).data,
    }


def grilla_periodo(params) -> dict:
    """
    Grilla empleado × día para responder "¿cómo estará conformado el equipo
    durante un período?". Incluye cuántos trabajan cada día hábil.
    """
    desde, hasta = parse_periodo(params, max_dias=92)
    fecha_hoy = hoy()
    empleados = _empleados_del_periodo(params, hasta)
    novedades = novedades_por_empleado(desde, hasta, [e.id for e in empleados])
    no_laborables = {d.fecha: d for d in DiaNoLaborable.objects.filter(fecha__range=(desde, hasta))}
    dias = list(rango_fechas(desde, hasta))

    arbol = Arbol()
    trabajando_por_dia = Counter()
    filas = []
    for empleado in empleados:
        celdas = {}
        for dia in dias:
            if empleado.fecha_ingreso > dia:
                continue
            # Las novedades abiertas (fin desconocido) no se proyectan después de hoy.
            vigentes = [
                n
                for n in novedades.get(empleado.id, [])
                if novedad_vigente_en(n, dia) and not (n.fecha_hasta is None and dia > fecha_hoy)
            ]
            if vigentes:
                celdas[dia.isoformat()] = [
                    {"novedad_id": n.id, "tipo": n.tipo.nombre, "color": n.tipo.color_efectivo, "categoria_id": n.tipo.categoria_id}
                    for n in vigentes
                ]
            if not any(not n.tipo.categoria.cuenta_como_presente for n in vigentes):
                trabajando_por_dia[dia] += 1
        fila = _fila_empleado(empleado, novedades.get(empleado.id, []), arbol)
        fila["celdas"] = celdas
        filas.append(fila)

    estados = [e for e in (params.get("estado") or "").split(",") if e]
    return {
        "desde": desde,
        "hasta": hasta,
        "dias": [
            {
                "fecha": dia,
                "fin_de_semana": es_fin_de_semana(dia),
                "no_laborable": (
                    {"tipo": no_laborables[dia].get_tipo_display(), "motivo": no_laborables[dia].motivo}
                    if dia in no_laborables
                    else None
                ),
                "trabajando": trabajando_por_dia.get(dia, 0),
            }
            for dia in dias
        ],
        "empleados": [f for f in filas if _coincide_estado(f, estados)],
    }
