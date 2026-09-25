"""Cálculo de saldos y asignaciones."""
from collections import defaultdict
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
            TipoNovedad.objects.select_related("categoria").filter(descuenta_saldo=True, saldo_de__isnull=True)
        )
    return bolsas if incluir_ocultas else [b for b in bolsas if b.mostrar_saldo]


def _saldo_vacio(bolsa: TipoNovedad, miembros: list[TipoNovedad]) -> dict:
    return {
        "tipo_id": bolsa.id,
        "tipo": bolsa.nombre,
        # Para agrupar y totalizar (p. ej. todas las bolsas de vacaciones, de cualquier año).
        "categoria_id": bolsa.categoria_id,
        "categoria": bolsa.categoria.nombre,
        "color": bolsa.color_efectivo,
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
    Calcula saldos en bloque. Devuelve {empleado_id: {bolsa_id: saldo}}.

    Una bolsa agrupa su propio tipo y los que la comparten (`saldo_de`): sus
    acreditaciones suman y sus licencias descuentan del mismo disponible.
    - usados: días de novedades ya iniciadas a la fecha de referencia.
    - programados: días de novedades futuras ya registradas.
    - disponible: acreditados − usados − programados.
    """
    fecha_ref = fecha_ref or hoy()
    bolsas = bolsas_de_saldo(tipos)
    miembros_por_bolsa = {b.id: [b] for b in bolsas}
    for t in TipoNovedad.objects.filter(saldo_de__in=bolsas).order_by("orden", "nombre"):
        miembros_por_bolsa[t.saldo_de_id].append(t)
    bolsa_de_tipo = {m.id: b_id for b_id, miembros in miembros_por_bolsa.items() for m in miembros}
    tipo_ids = list(bolsa_de_tipo)
    empleado_ids = list(empleado_ids)
    resultado = defaultdict(lambda: {b.id: _saldo_vacio(b, miembros_por_bolsa[b.id]) for b in bolsas})

    def sumar(empleado_id, tipo_id, campo, valor):
        saldo = resultado[empleado_id][bolsa_de_tipo[tipo_id]]
        saldo[campo] += valor
        saldo["desglose"][tipo_id][campo] += valor

    movimientos = (
        MovimientoSaldo.objects.filter(empleado_id__in=empleado_ids, tipo_novedad_id__in=tipo_ids)
        .values("empleado_id", "tipo_novedad_id", "concepto")
        .annotate(total=Sum("dias"))
    )
    for m in movimientos:
        sumar(m["empleado_id"], m["tipo_novedad_id"], CAMPO_POR_CONCEPTO[m["concepto"]], m["total"])

    novedades = Novedad.objects.filter(empleado_id__in=empleado_ids, tipo_id__in=tipo_ids, dias__isnull=False)
    if excluir_novedad is not None and excluir_novedad.pk:
        novedades = novedades.exclude(pk=excluir_novedad.pk)
    for campo, filtro in (("usados", {"fecha_desde__lte": fecha_ref}), ("programados", {"fecha_desde__gt": fecha_ref})):
        for fila in novedades.filter(**filtro).values("empleado_id", "tipo_id").annotate(total=Sum("dias")):
            sumar(fila["empleado_id"], fila["tipo_id"], campo, fila["total"])

    for empleado_id in empleado_ids:
        for saldo in resultado[empleado_id].values():
            for item in [saldo, *saldo["desglose"].values()]:
                item["acreditados"] = item["asignados"] + item["compensados"] + item["ajustes"]
                item["disponible"] = item["acreditados"] - item["usados"] - item["programados"]
            saldo["con_movimientos"] = any(
                saldo[c] for c in ("asignados", "compensados", "ajustes", "usados", "programados")
            )
            # Visibilidad en la ficha: regla por defecto o elección manual.
            saldo["visible_por_defecto"] = saldo["mostrar"] and saldo["con_movimientos"]
            saldo["visible"] = saldo["visible_por_defecto"]
            saldo["eleccion_manual"] = False
            saldo["desglose"] = list(saldo["desglose"].values())
    for pref in PreferenciaSaldo.objects.filter(empleado_id__in=empleado_ids, tipo_novedad_id__in=[b.id for b in bolsas]):
        saldo = resultado[pref.empleado_id][pref.tipo_novedad_id]
        saldo["visible"] = pref.visible
        saldo["eleccion_manual"] = True
    return resultado


def guardar_preferencia(empleado, tipo: TipoNovedad, visible: bool | None) -> None:
    """Guarda la elección manual; `None` la borra y vuelve a la regla por defecto."""
    if visible is None:
        PreferenciaSaldo.objects.filter(empleado=empleado, tipo_novedad=tipo).delete()
    else:
        PreferenciaSaldo.objects.update_or_create(empleado=empleado, tipo_novedad=tipo, defaults={"visible": visible})


def calcular_saldo(empleado, tipo: TipoNovedad, excluir_novedad=None) -> dict:
    """Saldo de la bolsa que usa el tipo (la propia o la compartida)."""
    bolsa = tipo.tipo_saldo
    return saldos_por_empleado([empleado.id], [tipo], excluir_novedad=excluir_novedad)[empleado.id][bolsa.id]


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
