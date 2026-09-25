"""
Novedades del personal: vacaciones, licencias, ausencias, comisiones, etc.

- CategoriaEstado: agrupa tipos para el dashboard (Vacaciones, Licencia médica,
  Ausente...). Define color y si el agente cuenta como "trabajando".
- TipoNovedad: tipo concreto configurable (Licencia vacaciones, Licencia
  invernal, Licencia médica...). Define cómo se computan los días y si
  descuenta saldo.
- Novedad: registro de un período de un empleado con un tipo.

El estado del día de cada empleado se deriva de las novedades vigentes.
"""
import os
import uuid

from django.conf import settings
from django.db import models
from simple_history.models import HistoricalRecords

from apps.calendario.services import ComputoDias
from apps.core.models import CatalogoBase, TimeStampedModel


class CategoriaEstado(CatalogoBase):
    color = models.CharField("color", max_length=20, default="#8c8c8c")
    cuenta_como_presente = models.BooleanField(
        "cuenta como presente",
        default=False,
        help_text="Si está marcado, el agente se considera trabajando (p. ej. comisión de servicio).",
    )

    history = HistoricalRecords()

    class Meta(CatalogoBase.Meta):
        verbose_name = "categoría de estado"
        verbose_name_plural = "categorías de estado"


class TipoNovedad(CatalogoBase):
    categoria = models.ForeignKey(
        CategoriaEstado, verbose_name="categoría", on_delete=models.PROTECT, related_name="tipos"
    )
    color = models.CharField("color", max_length=20, blank=True, help_text="Vacío = color de la categoría.")
    computo_dias = models.CharField(
        "cómputo de días", max_length=10, choices=ComputoDias.CHOICES, default=ComputoDias.HABILES
    )
    descuenta_saldo = models.BooleanField(
        "descuenta saldo",
        default=False,
        help_text="Los días se descuentan del saldo del empleado para este tipo (p. ej. vacaciones).",
    )
    saldo_de = models.ForeignKey(
        "self",
        verbose_name="usa el saldo de",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="tipos_que_comparten_saldo",
        help_text=(
            "Comparte la bolsa de días de otro tipo (p. ej. Licencia invernal → Licencia vacaciones). "
            "Sus acreditaciones suman a esa bolsa y sus licencias descuentan de ella."
        ),
    )
    mostrar_saldo = models.BooleanField(
        "mostrar saldo",
        default=True,
        help_text="Si se desmarca, la bolsa de días no se muestra en fichas, saldos ni reportes "
        "(p. ej. una licencia de un año anterior ya consumida). Los datos se conservan.",
    )
    requiere_documentacion = models.BooleanField("requiere documentación", default=False)
    permite_sin_fecha_fin = models.BooleanField(
        "permite quedar abierta",
        default=False,
        help_text="Permite registrar la novedad sin fecha de finalización hasta que se cierre.",
    )

    history = HistoricalRecords()

    class Meta(CatalogoBase.Meta):
        verbose_name = "tipo de novedad"
        verbose_name_plural = "tipos de novedad"

    @property
    def color_efectivo(self) -> str:
        return self.color or self.categoria.color

    @property
    def tipo_saldo(self) -> "TipoNovedad":
        """Tipo cuya bolsa de días usa (él mismo si no comparte saldo)."""
        return self.saldo_de or self


class EstadoNovedad(models.TextChoices):
    """Estado del registro (se calcula; no se guarda)."""

    PROGRAMADA = "PROGRAMADA", "Programada"
    EN_CURSO = "EN_CURSO", "En curso"
    FINALIZADA = "FINALIZADA", "Finalizada"
    INTERRUMPIDA = "INTERRUMPIDA", "Interrumpida"
    ANULADA = "ANULADA", "Anulada"


ESTADOS_HISTORIAL = {EstadoNovedad.FINALIZADA, EstadoNovedad.INTERRUMPIDA, EstadoNovedad.ANULADA}


class NovedadQuerySet(models.QuerySet):
    def activas(self, fecha):
        """Programadas o en curso (incluye las abiertas)."""
        return self.filter(anulada=False, fecha_hasta_original__isnull=True).filter(
            models.Q(fecha_hasta__isnull=True) | models.Q(fecha_hasta__gte=fecha)
        )

    def historial(self, fecha):
        """Finalizadas, interrumpidas o anuladas."""
        return self.filter(
            models.Q(anulada=True) | models.Q(fecha_hasta_original__isnull=False) | models.Q(fecha_hasta__lt=fecha)
        )

    def con_relaciones(self):
        return self.select_related("empleado__unidad", "empleado__modalidad", "tipo__categoria", "creado_por")

    def en_periodo(self, desde, hasta):
        """Novedades que se superponen con el período [desde, hasta]. Las abiertas siguen vigentes."""
        return self.filter(fecha_desde__lte=hasta).filter(
            models.Q(fecha_hasta__gte=desde) | models.Q(fecha_hasta__isnull=True)
        )


class NovedadManager(models.Manager.from_queryset(NovedadQuerySet)):
    def get_queryset(self):
        return super().get_queryset().filter(anulada=False)


class Novedad(TimeStampedModel):
    empleado = models.ForeignKey(
        "personal.Empleado", verbose_name="empleado", on_delete=models.PROTECT, related_name="novedades"
    )
    tipo = models.ForeignKey(TipoNovedad, verbose_name="tipo", on_delete=models.PROTECT, related_name="novedades")
    fecha_desde = models.DateField("desde")
    fecha_hasta = models.DateField("hasta", null=True, blank=True, help_text="Vacío = novedad abierta.")
    dias = models.PositiveIntegerField(
        "días", null=True, blank=True, help_text="Se calcula automáticamente según el tipo; puede ajustarse."
    )
    motivo = models.CharField("motivo", max_length=255, blank=True)
    observaciones = models.TextField("observaciones", blank=True)

    # Interrupción: se acorta la novedad y los días no tomados vuelven al saldo
    # (el saldo se calcula a partir de `dias`, así que el reintegro es automático).
    fecha_hasta_original = models.DateField(
        "hasta (original)", null=True, blank=True, help_text="Fecha de fin prevista antes de interrumpirse."
    )
    dias_original = models.PositiveIntegerField("días (original)", null=True, blank=True)
    motivo_interrupcion = models.CharField("motivo de la interrupción", max_length=255, blank=True)

    # Anulación: reemplaza al borrado de licencias ya iniciadas. El registro se
    # conserva, pero deja de contar para saldos, dashboard, calendario y reportes.
    anulada = models.BooleanField("anulada", default=False)
    fecha_anulacion = models.DateTimeField("fecha de anulación", null=True, blank=True)
    motivo_anulacion = models.CharField("motivo de la anulación", max_length=255, blank=True)
    anulada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="anulada por", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    history = HistoricalRecords()
    # `objects` excluye las anuladas para que ningún cálculo las tome por error.
    objects = NovedadManager()
    # `todas` incluye las anuladas (listados e historial).
    todas = models.Manager.from_queryset(NovedadQuerySet)()

    class Meta:
        verbose_name = "novedad"
        verbose_name_plural = "novedades"
        ordering = ["-fecha_desde", "empleado__apellido"]
        indexes = [models.Index(fields=["fecha_desde", "fecha_hasta"])]

    def __str__(self):
        return f"{self.empleado} - {self.tipo} ({self.fecha_desde:%d/%m/%Y})"

    @property
    def abierta(self) -> bool:
        return self.fecha_hasta is None

    def estado(self, fecha=None) -> str:
        from apps.core.fechas import hoy

        fecha = fecha or hoy()
        if self.anulada:
            return EstadoNovedad.ANULADA
        if self.fecha_hasta_original is not None:
            return EstadoNovedad.INTERRUMPIDA
        if self.fecha_desde > fecha:
            return EstadoNovedad.PROGRAMADA
        if self.fecha_hasta is not None and self.fecha_hasta < fecha:
            return EstadoNovedad.FINALIZADA
        return EstadoNovedad.EN_CURSO

    @property
    def interrumpida(self) -> bool:
        return self.fecha_hasta_original is not None

    @property
    def dias_reintegrados(self) -> int:
        if not self.interrumpida or self.dias_original is None:
            return 0
        return max(self.dias_original - (self.dias or 0), 0)


def _ruta_documento(instance, filename):
    extension = os.path.splitext(filename)[1].lower()
    return f"novedades/{instance.novedad.fecha_desde:%Y/%m}/{uuid.uuid4().hex}{extension}"


class DocumentoNovedad(models.Model):
    """Documentación respaldatoria (certificados, notas, resoluciones)."""

    EXTENSIONES_PERMITIDAS = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx", ".odt"]

    novedad = models.ForeignKey(Novedad, on_delete=models.CASCADE, related_name="documentos")
    archivo = models.FileField("archivo", upload_to=_ruta_documento)
    nombre_original = models.CharField("nombre", max_length=255)
    descripcion = models.CharField("descripción", max_length=255, blank=True)
    subido = models.DateTimeField("subido", auto_now_add=True)
    subido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        verbose_name = "documento de novedad"
        verbose_name_plural = "documentos de novedad"
        ordering = ["-subido"]

    def __str__(self):
        return self.nombre_original
