"""Cálculo de saldos y asignaciones."""
from datetime import date

from django.db import transaction
from django.db.models import Sum

from apps.core.fechas import hoy
from apps.novedades.models import Novedad, TipoNovedad

from .models import ConceptoMovimiento, MovimientoSaldo, PreferenciaSaldo


CAMPOS = ("asignados", "compensados", "ajustes", "acreditados", "usados", "programados", "disponible")
CAMPO_POR_CONCEPTO = {
    ConceptoMovimiento.ASIGNACION: "asignados",
    ConceptoMovimiento.COMPENSACION: "compensados",
    ConceptoMovimiento.AJUSTE: "ajustes",
}


def bolsas_de_saldo(tipos=None, incluir_ocultas: bool = True) -> list[TipoNovedad]:
    """
    Bolsas de días: tipos que descuentan saldo y no usan el de otro tipo.
    Si se pasan `tipos`, devuelve las bolsas que esos tipos usan.
    Con `incluir_ocultas=False` se excluyen las marcadas "no mostrar saldo".
    """
    if tipos is not None:
        bolsas = list({t.tipo_saldo.id: t.tipo_saldo for t in tipos if t.descuenta_saldo or t.saldo_de_id}.values())
    else:
        bolsas = list(
            TipoNovedad.objects.filter(descuenta_saldo=True, saldo_de__isnull=True)
        )
    return bolsas if incluir_ocultas else [b for b in bolsas if b.mostrar_saldo]


def clave_saldo(bolsa: TipoNovedad, anio: int | None) -> tuple[int, int | None]:
    """Clave de una bolsa: (id del artículo dueño, año) — el año sólo si la bolsa es por año."""
    return (bolsa.id, anio if bolsa.saldo_por_anio else None)


def _saldo_vacio(bolsa: TipoNovedad, miembros: list[TipoNovedad], anio: int | None) -> dict:
    return {
        "tipo_id": bolsa.id,
        "tipo": bolsa.nombre,
        # Año de la bolsa (sólo en artículos con "saldo por año"; null = bolsa única).
        "anio": anio,
        "clave": f"{bolsa.id}-{anio}" if anio is not None else str(bolsa.id),
        "color": bolsa.color,
        "mostrar": bolsa.mostrar_saldo,
        "con_movimientos": False,
        # Otros tipos que comparten esta bolsa (p. ej. Licencia invernal).
        "incluye": [m.nombre for m in miembros if m.id != bolsa.id],
        **{campo: 0 for campo in CAMPOS},
        # Detalle por tipo, para saber de dónde vienen y en qué se usaron los días.
        "desglose": {m.id: {"tipo_id": m.id, "tipo": m.nombre, **{c: 0 for c in CAMPOS}} for m in miembros},
    }


def saldos_por_empleado(empleado_ids, tipos=None, fecha_ref: date | None = None, excluir_novedad=None) -> dict:
    """
    Calcula saldos en bloque. Devuelve {empleado_id: {(bolsa_id, año): saldo}}.

    Una bolsa agrupa su propio tipo y los que la comparten (`saldo_de`): sus
    acreditaciones suman y sus licencias descuentan del mismo disponible. Si el
    dueño tiene "saldo por año", hay una bolsa por año: las asignaciones van al
    año del movimiento y las licencias al año elegido (`anio_saldo`). Las bolsas
    únicas usan año None y aparecen siempre; las anuales, sólo los años usados.
    - usados: días de novedades ya iniciadas a la fecha de referencia.
    - programados: días de novedades futuras ya registradas.
    - disponible: acreditados − usados − programados.
    """
    fecha_ref = fecha_ref or hoy()
    bolsas = bolsas_de_saldo(tipos)
    miembros_por_bolsa = {b.id: [b] for b in bolsas}
    for t in TipoNovedad.objects.filter(saldo_de__in=bolsas).order_by("orden", "nombre"):
        miembros_por_bolsa[t.saldo_de_id].append(t)
    bolsa_por_id = {b.id: b for b in bolsas}
    bolsa_de_tipo = {m.id: b_id for b_id, miembros in miembros_por_bolsa.items() for m in miembros}
    tipo_ids = list(bolsa_de_tipo)
    empleado_ids = list(empleado_ids)
    resultado = {
        e: {(b.id, None): _saldo_vacio(b, miembros_por_bolsa[b.id], None) for b in bolsas if not b.saldo_por_anio}
        for e in empleado_ids
    }

    def sumar(empleado_id, tipo_id, anio, campo, valor):
        bolsa = bolsa_por_id[bolsa_de_tipo[tipo_id]]
        clave = clave_saldo(bolsa, anio)
        saldos = resultado.setdefault(empleado_id, {})
        if clave not in saldos:
            saldos[clave] = _saldo_vacio(bolsa, miembros_por_bolsa[bolsa.id], clave[1])
        saldos[clave][campo] += valor
        saldos[clave]["desglose"][tipo_id][campo] += valor

    movimientos = (
        MovimientoSaldo.objects.filter(empleado_id__in=empleado_ids, tipo_novedad_id__in=tipo_ids)
        .values("empleado_id", "tipo_novedad_id", "anio", "concepto")
        .annotate(total=Sum("dias"))
    )
    for m in movimientos:
        sumar(m["empleado_id"], m["tipo_novedad_id"], m["anio"], CAMPO_POR_CONCEPTO[m["concepto"]], m["total"])

    novedades = Novedad.objects.filter(empleado_id__in=empleado_ids, tipo_id__in=tipo_ids, dias__isnull=False)
    if excluir_novedad is not None and excluir_novedad.pk:
        novedades = novedades.exclude(pk=excluir_novedad.pk)
    for campo, filtro in (("usados", {"fecha_desde__lte": fecha_ref}), ("programados", {"fecha_desde__gt": fecha_ref})):
        filas = novedades.filter(**filtro).values("empleado_id", "tipo_id", "anio_saldo", "fecha_desde__year").annotate(total=Sum("dias"))
        for fila in filas:
            # Licencias anteriores a activar "saldo por año": cuentan en el año en que empiezan.
            anio = fila["anio_saldo"] or fila["fecha_desde__year"]
            sumar(fila["empleado_id"], fila["tipo_id"], anio, campo, fila["total"])

    preferencias = {
        (p.empleado_id, p.tipo_novedad_id, p.anio): p.visible
        for p in PreferenciaSaldo.objects.filter(empleado_id__in=empleado_ids, tipo_novedad_id__in=[b.id for b in bolsas])
    }
    for empleado_id in empleado_ids:
        ordenados = {}
        # Orden: como las bolsas configuradas; dentro de una bolsa anual, del año más viejo al más nuevo.
        orden_bolsa = {b.id: i for i, b in enumerate(bolsas)}
        for clave in sorted(resultado[empleado_id], key=lambda c: (orden_bolsa[c[0]], c[1] or 0)):
            saldo = resultado[empleado_id][clave]
            for item in [saldo, *saldo["desglose"].values()]:
                item["acreditados"] = item["asignados"] + item["compensados"] + item["ajustes"]
                item["disponible"] = item["acreditados"] - item["usados"] - item["programados"]
            saldo["con_movimientos"] = any(
                saldo[c] for c in ("asignados", "compensados", "ajustes", "usados", "programados")
            )
            # Visibilidad en la ficha: regla por defecto o elección manual.
            saldo["visible_por_defecto"] = saldo["mostrar"] and saldo["con_movimientos"]
            elegido = preferencias.get((empleado_id, clave[0], clave[1]))
            saldo["visible"] = saldo["visible_por_defecto"] if elegido is None else elegido
            saldo["eleccion_manual"] = elegido is not None
            saldo["desglose"] = list(saldo["desglose"].values())
            ordenados[clave] = saldo
        resultado[empleado_id] = ordenados
    return resultado


def guardar_preferencia(empleado, tipo: TipoNovedad, visible: bool | None, anio: int | None = None) -> None:
    """Guarda la elección manual (por bolsa y año); `None` la borra y vuelve a la regla por defecto."""
    anio = anio if tipo.saldo_por_anio else None
    if visible is None:
        PreferenciaSaldo.objects.filter(empleado=empleado, tipo_novedad=tipo, anio=anio).delete()
    else:
        PreferenciaSaldo.objects.update_or_create(empleado=empleado, tipo_novedad=tipo, anio=anio, defaults={"visible": visible})


def calcular_saldo(empleado, tipo: TipoNovedad, anio: int | None = None, excluir_novedad=None) -> dict:
    """Saldo de la bolsa que usa el tipo (la propia o la compartida) y, si es anual, del año indicado."""
    bolsa = tipo.tipo_saldo
    clave = clave_saldo(bolsa, anio)
    saldos = saldos_por_empleado([empleado.id], [tipo], excluir_novedad=excluir_novedad)[empleado.id]
    return saldos.get(clave) or {**_saldo_vacio(bolsa, [bolsa], clave[1]), "acreditados": 0}


@transaction.atomic
def asignar_dias_masivo(*, empleados, tipo: TipoNovedad, anio: int, dias: int, motivo: str, usuario, omitir_existentes=True):
    """
    Asigna días a varios empleados. Si `omitir_existentes`, saltea a quienes ya
    tienen una asignación de ese tipo para el mismo año. Devuelve (creados, omitidos).
    """
    ya_asignados = set()
    if omitir_existentes:
        ya_asignados = set(
            MovimientoSaldo.objects.filter(
                tipo_novedad=tipo, anio=anio, concepto=ConceptoMovimiento.ASIGNACION, empleado__in=empleados
            ).values_list("empleado_id", flat=True)
        )
    nuevos = [
        MovimientoSaldo(
            empleado=empleado,
            tipo_novedad=tipo,
            concepto=ConceptoMovimiento.ASIGNACION,
            anio=anio,
            dias=dias,
            fecha=hoy(),
            motivo=motivo,
            creado_por=usuario,
        )
        for empleado in empleados
        if empleado.id not in ya_asignados
    ]
    # save() individual para que quede registrado en el historial de cambios.
    for movimiento in nuevos:
        movimiento.save()
    return len(nuevos), len(ya_asignados)
