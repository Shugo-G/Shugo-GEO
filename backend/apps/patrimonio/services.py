"""Reglas de negocio del cargo patrimonial."""
from datetime import date

from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import CargoPatrimonial, TipoCierre


def validar_iub_disponible(iub: str, excluir: CargoPatrimonial | None = None) -> None:
    """
    Un mismo IUB no puede estar a cargo de dos agentes a la vez, y un bien dado
    de baja (fuera de servicio) no puede volver a asignarse.
    """
    if not iub:
        return
    mismos = CargoPatrimonial.objects.filter(iub__iexact=iub.strip())
    if excluir is not None:
        mismos = mismos.exclude(pk=excluir.pk)
    if actual := mismos.vigentes().select_related("empleado").first():
        raise ValidationError({"iub": f"El IUB {iub} ya está a cargo de {actual.empleado.nombre_completo}."})
    if baja := mismos.filter(tipo_cierre=TipoCierre.BAJA).first():
        raise ValidationError({"iub": f"El bien con IUB {iub} fue dado de baja (fuera de servicio) el {baja.fecha_cierre:%d/%m/%Y}."})


def _validar_cierre(cargo: CargoPatrimonial, fecha: date) -> None:
    if not cargo.vigente:
        raise ValidationError({"detail": "El cargo ya está cerrado."})
    if fecha < cargo.fecha_asignacion:
        raise ValidationError({"fecha": "No puede ser anterior a la fecha de asignación."})


def dar_de_baja(cargo: CargoPatrimonial, fecha: date, motivo: str = "") -> CargoPatrimonial:
    """El insumo queda fuera de servicio: se cierra el cargo y el IUB no puede volver a asignarse."""
    _validar_cierre(cargo, fecha)
    cargo.fecha_cierre = fecha
    cargo.tipo_cierre = TipoCierre.BAJA
    cargo.destino = ""
    cargo.motivo_cierre = motivo.strip()
    cargo.save()
    return cargo


@transaction.atomic
def transferir(
    cargo: CargoPatrimonial,
    fecha: date,
    *,
    empleado=None,
    area_externa: str = "",
    planilla_cargo: str = "",
    motivo: str = "",
    usuario=None,
) -> CargoPatrimonial:
    """
    Transfiere el bien a otro empleado (cierra el cargo y abre uno nuevo con el
    mismo IUB y una planilla de cargo nueva, obligatoria y distinta) o a un área
    ajena a Informática (cierra el cargo con ese destino; el bien queda sin
    agente a cargo). Devuelve el cargo cerrado.
    """
    _validar_cierre(cargo, fecha)
    if bool(empleado) == bool(area_externa.strip()):
        raise ValidationError({"destino": "Indique un empleado o un área de destino (sólo uno)."})
    if empleado is not None and empleado.pk == cargo.empleado_id:
        raise ValidationError({"empleado": "El bien ya está a cargo de ese empleado."})
    planilla_cargo = (planilla_cargo or "").strip()
    if empleado is not None:
        if not planilla_cargo:
            raise ValidationError({"planilla_cargo": "Indique la nueva planilla de cargo."})
        if planilla_cargo.lower() == cargo.planilla_cargo.lower():
            raise ValidationError({"planilla_cargo": "La planilla de cargo debe ser distinta de la actual."})

    cargo.fecha_cierre = fecha
    cargo.motivo_cierre = motivo.strip()
    if empleado is not None:
        nuevo = CargoPatrimonial.objects.create(
            empleado=empleado,
            tipo_insumo=cargo.tipo_insumo,
            planilla_cargo=planilla_cargo,
            iub=cargo.iub,
            descripcion=cargo.descripcion,
            fecha_asignacion=fecha,
            creado_por=usuario,
        )
        cargo.tipo_cierre = TipoCierre.TRANSFERENCIA_EMPLEADO
        cargo.destino = empleado.nombre_completo
        cargo.transferido_a = nuevo
    else:
        cargo.tipo_cierre = TipoCierre.TRANSFERENCIA_EXTERNA
        cargo.destino = area_externa.strip()
    cargo.save()
    return cargo
