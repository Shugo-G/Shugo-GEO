"""
Cargo patrimonial: bienes asignados al personal.

Cada registro es un período en que un bien estuvo a cargo de un agente. Al
cerrarse (baja o transferencia) se conserva con fecha, tipo de cierre, destino
y motivo, de modo que el IUB permite reconstruir la trayectoria del bien:
    - Transferencia a otro empleado: se cierra el cargo y se abre uno nuevo con
      el mismo IUB y una nueva planilla de cargo.
    - Transferencia a un área ajena a Informática: se cierra con ese destino y
      el bien queda sin agente a cargo.
    - Baja: el insumo queda fuera de servicio; su IUB no puede volver a asignarse.
"""
from django.db import models
from simple_history.models import HistoricalRecords

from apps.core.models import CatalogoBase, TimeStampedModel


class TipoInsumo(CatalogoBase):
    """Tipo de bien (CPU, Monitor, Notebook...). Configurable por el administrador."""

    history = HistoricalRecords()

    class Meta(CatalogoBase.Meta):
        verbose_name = "tipo de insumo"
        verbose_name_plural = "tipos de insumo"


class TipoCierre(models.TextChoices):
    BAJA = "BAJA", "Baja (fuera de servicio)"
    TRANSFERENCIA_EMPLEADO = "TRANSFERENCIA_EMPLEADO", "Transferencia a empleado"
    TRANSFERENCIA_EXTERNA = "TRANSFERENCIA_EXTERNA", "Transferencia a otra área"


class CargoPatrimonialQuerySet(models.QuerySet):
    def vigentes(self):
        return self.filter(fecha_cierre__isnull=True)

    def con_relaciones(self):
        return self.select_related("empleado__unidad", "tipo_insumo", "creado_por")


class CargoPatrimonial(TimeStampedModel):
    empleado = models.ForeignKey(
        "personal.Empleado", verbose_name="empleado", on_delete=models.PROTECT, related_name="cargos_patrimoniales"
    )
    # Legajo al momento de la asignación: queda en el historial aunque luego cambie.
    legajo = models.CharField("legajo", max_length=20, editable=False)
    tipo_insumo = models.ForeignKey(TipoInsumo, verbose_name="insumo", on_delete=models.PROTECT, related_name="cargos")
    planilla_cargo = models.CharField(
        "planilla de cargo", max_length=60, help_text="Cambia en cada transferencia entre empleados."
    )
    iub = models.CharField(
        "IUB", max_length=60, db_index=True, help_text="Identificación única del bien; se mantiene en las transferencias."
    )
    descripcion = models.TextField("descripción", blank=True, help_text="Marca, modelo, número de serie, detalles.")
    fecha_asignacion = models.DateField("fecha de asignación")

    fecha_cierre = models.DateField("fecha de cierre", null=True, blank=True)
    tipo_cierre = models.CharField("tipo de cierre", max_length=30, choices=TipoCierre.choices, blank=True)
    destino = models.CharField("destino", max_length=160, blank=True, help_text="Empleado o área a la que se transfirió.")
    motivo_cierre = models.CharField("motivo", max_length=255, blank=True)
    transferido_a = models.OneToOneField(
        "self", verbose_name="cargo siguiente", on_delete=models.SET_NULL, null=True, blank=True, related_name="transferido_desde"
    )

    history = HistoricalRecords()
    objects = CargoPatrimonialQuerySet.as_manager()

    class Meta:
        verbose_name = "cargo patrimonial"
        verbose_name_plural = "cargos patrimoniales"
        ordering = ["-fecha_asignacion", "-id"]

    def __str__(self):
        return f"{self.tipo_insumo} {self.iub or ''} · {self.empleado}"

    @property
    def vigente(self) -> bool:
        return self.fecha_cierre is None

    def save(self, *args, **kwargs):
        if not self.legajo and self.empleado_id:
            self.legajo = self.empleado.legajo
        super().save(*args, **kwargs)
