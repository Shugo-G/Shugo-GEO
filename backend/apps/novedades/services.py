"""Reglas de negocio de las novedades."""
from datetime import date

from apps.calendario.services import contar_dias

from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import EstadoNovedad, Novedad, TipoNovedad


def calcular_dias(tipo: TipoNovedad, desde: date, hasta: date | None) -> int | None:
    """Días que abarca la novedad según el cómputo del tipo. Las abiertas no tienen días."""
    if hasta is None:
        return None
    return contar_dias(desde, hasta, tipo.computo_dias)


def validar_novedad(
    *, empleado, tipo: TipoNovedad, desde: date, hasta: date | None, dias: int | None, instancia: Novedad | None = None
) -> dict[str, str]:
    """Devuelve un dict de errores por campo (vacío si es válida)."""
    from apps.vacaciones.services import calcular_saldo

    errores = {}
    if hasta and hasta < desde:
        errores["fecha_hasta"] = "No puede ser anterior a la fecha de inicio."
    if hasta is None and not tipo.permite_sin_fecha_fin:
        errores["fecha_hasta"] = "Este tipo de novedad requiere fecha de finalización."
    if empleado.fecha_ingreso and desde < empleado.fecha_ingreso:
        errores["fecha_desde"] = "No puede ser anterior a la fecha de ingreso del empleado."

    if tipo.descuenta_saldo and not errores and dias:
        saldo = calcular_saldo(empleado, tipo, excluir_novedad=instancia)
        if dias > saldo["disponible"]:
            errores["dias"] = (
                f"Saldo insuficiente: dispone de {saldo['disponible']} día(s) de {tipo.nombre.lower()} "
                f"y está registrando {dias}."
            )
    return errores


def interrumpir_novedad(novedad: Novedad, fecha_hasta: date, motivo: str = "") -> Novedad:
    """
    Corta una novedad antes de su fecha de fin prevista. Recalcula los días
    según el tipo; como el saldo se calcula a partir de los días registrados,
    los días no tomados vuelven automáticamente al saldo disponible.
    Conserva la fecha y los días originales para el historial.
    """
    if novedad.anulada:
        raise ValidationError({"detail": "La novedad está anulada."})
    if novedad.fecha_hasta is None:
        raise ValidationError({"fecha_hasta": "La novedad está abierta: use 'Cerrar' para indicar su fecha de fin."})
    if fecha_hasta < novedad.fecha_desde:
        raise ValidationError(
            {"fecha_hasta": "No puede ser anterior al inicio. Si la licencia no llegó a tomarse, elimínela."}
        )
    if fecha_hasta >= novedad.fecha_hasta:
        raise ValidationError({"fecha_hasta": "Debe ser anterior a la fecha de fin actual."})

    if novedad.fecha_hasta_original is None:
        novedad.fecha_hasta_original = novedad.fecha_hasta
        novedad.dias_original = novedad.dias
    novedad.fecha_hasta = fecha_hasta
    novedad.dias = calcular_dias(novedad.tipo, novedad.fecha_desde, fecha_hasta)
    novedad.motivo_interrupcion = motivo.strip()
    novedad.save()
    return novedad


def eliminar_tipo(tipo: TipoNovedad) -> None:
    """
    Elimina un tipo de novedad. Las novedades anuladas de ese tipo (registros sin
    efecto) se eliminan con él, incluida su documentación. Si queda cualquier otro
    uso (licencias vigentes o finalizadas, días asignados, tipos que comparten su
    saldo) la base lo impide y se informa qué lo bloquea.
    """
    from django.db import transaction

    with transaction.atomic():
        for novedad in Novedad.todas.filter(tipo=tipo, anulada=True):
            for documento in novedad.documentos.all():
                documento.archivo.delete(save=False)
            novedad.delete()
        tipo.delete()


# Campos que pueden corregirse aunque la licencia ya haya finalizado.
CAMPOS_EDITABLES_EN_HISTORIAL = {"motivo", "observaciones"}


def validar_edicion(instancia: Novedad, attrs: dict) -> dict[str, str]:
    """
    Reglas de edición según el estado, para que no se reintegren días ya
    tomados por error:
    - Programada: todo editable.
    - En curso: sólo puede extenderse la fecha de fin (acortar = Interrumpir).
    - Finalizada / interrumpida: sólo motivo y observaciones (errores = Anular).
    - Anulada: nada.
    """
    estado = instancia.estado()
    cambios = {campo for campo, valor in attrs.items() if getattr(instancia, campo) != valor}
    if not cambios or estado == EstadoNovedad.PROGRAMADA:
        return {}
    if estado == EstadoNovedad.ANULADA:
        return {"detail": "La novedad está anulada y no puede modificarse."}

    if estado in (EstadoNovedad.FINALIZADA, EstadoNovedad.INTERRUMPIDA):
        bloqueados = cambios - CAMPOS_EDITABLES_EN_HISTORIAL
        if bloqueados:
            return {
                campo: "La licencia ya finalizó: sólo pueden modificarse el motivo, las observaciones y la "
                "documentación. Si fue cargada por error, anúlela."
                for campo in bloqueados
            }
        return {}

    # En curso
    errores = {}
    for campo in ("empleado", "tipo", "fecha_desde"):
        if campo in cambios:
            errores[campo] = "No puede modificarse en una licencia en curso."
    if "dias" in cambios and "fecha_hasta" not in cambios:
        errores["dias"] = "Los días de una licencia en curso se calculan a partir de las fechas."
    nueva_hasta = attrs.get("fecha_hasta", instancia.fecha_hasta)
    if "fecha_hasta" in cambios and instancia.fecha_hasta and (nueva_hasta is None or nueva_hasta < instancia.fecha_hasta):
        errores["fecha_hasta"] = "Para acortar una licencia en curso use 'Interrumpir'."
    return errores


def puede_eliminarse(novedad: Novedad) -> bool:
    """
    Se eliminan las licencias que todavía no empezaron (no hay días tomados) y
    las cargadas hoy (corrección inmediata de un error de carga). Las demás ya
    iniciadas se interrumpen o se anulan, dejando registro.
    """
    from apps.core.fechas import hoy

    if novedad.anulada:
        return False
    cargada_hoy = timezone.localdate(novedad.creado) == hoy()
    return novedad.estado() == EstadoNovedad.PROGRAMADA or cargada_hoy


def anular_novedad(novedad: Novedad, motivo: str, usuario) -> Novedad:
    """
    Anula una novedad cargada por error. Se conserva el registro (con quién,
    cuándo y por qué), pero deja de contar: sus días vuelven al saldo.
    """
    if novedad.anulada:
        raise ValidationError({"detail": "La novedad ya está anulada."})
    if not (motivo or "").strip():
        raise ValidationError({"motivo": "Indique el motivo de la anulación."})
    novedad.anulada = True
    novedad.fecha_anulacion = timezone.now()
    novedad.motivo_anulacion = motivo.strip()
    novedad.anulada_por = usuario
    novedad.save()
    return novedad
