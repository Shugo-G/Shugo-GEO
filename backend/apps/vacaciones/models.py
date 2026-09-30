"""
Saldo de días (vacaciones u otros tipos que descuentan saldo).

El saldo se lleva como un libro de movimientos:
    saldo disponible = Σ movimientos (asignaciones + compensaciones ± ajustes)
                       − Σ días de novedades del tipo
Así los días no usados se acumulan año a año y todo queda trazable.
"""
from django.db import models
from simple_history.models import HistoricalRecords

from apps.core.models import TimeStampedModel


class ConceptoMovimiento(models.TextChoices):
    ASIGNACION = "ASIGNACION", "Asignación de días"
    COMPENSACION = "COMPENSACION", "Compensación por día trabajado"
    AJUSTE = "AJUSTE", "Ajuste manual"


class PreferenciaSaldo(models.Model):
    """
    Elección manual de mostrar u ocultar una bolsa de días en la ficha de un
    empleado. Sin registro se aplica la regla por defecto: visible si el tipo
    está marcado "mostrar saldo" y el empleado tiene movimientos en esa bolsa.
    """

    empleado = models.ForeignKey("personal.Empleado", on_delete=models.CASCADE, related_name="preferencias_saldo")
    tipo_novedad = models.ForeignKey("novedades.TipoNovedad", on_delete=models.CASCADE, related_name="+")
    visible = models.BooleanField()

    class Meta:
        verbose_name = "preferencia de saldo"
        verbose_name_plural = "preferencias de saldo"
        constraints = [models.UniqueConstraint(fields=["empleado", "tipo_novedad"], name="preferencia_saldo_unica")]


class MovimientoSaldo(TimeStampedModel):
    empleado = models.ForeignKey(
        "personal.Empleado", verbose_name="empleado", on_delete=models.PROTECT, related_name="movimientos_saldo"
    )
    tipo_novedad = models.ForeignKey(
        "novedades.TipoNovedad",
        verbose_name="artículo de licencia",
        on_delete=models.PROTECT,
        limit_choices_to={"descuenta_saldo": True},
        related_name="movimientos_saldo",
    )
    concepto = models.CharField("concepto", max_length=20, choices=ConceptoMovimiento.choices)
    anio = models.PositiveSmallIntegerField("año / período", help_text="Período al que corresponden los días.")
    dias = models.IntegerField("días", help_text="Positivo suma al saldo; negativo (sólo ajustes) resta.")
    fecha = models.DateField("fecha del movimiento")
    fecha_trabajada = models.DateField(
        "fecha trabajada", null=True, blank=True, help_text="Para compensaciones: día no laborable trabajado."
    )
    motivo = models.CharField("motivo / detalle", max_length=255, blank=True)

    history = HistoricalRecords()

    class Meta:
        verbose_name = "movimiento de saldo"
        verbose_name_plural = "movimientos de saldo"
        ordering = ["-fecha", "-id"]

    def __str__(self):
        return f"{self.empleado} {self.get_concepto_display()} {self.dias:+d} ({self.anio})"
