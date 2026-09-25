import uuid

from django.core.validators import RegexValidator
from django.db import models
from simple_history.models import HistoricalRecords

from apps.core.models import TimeStampedModel

dni_validator = RegexValidator(r"^\d{7,9}$", "El DNI debe tener entre 7 y 9 dígitos, sin puntos.")


def _ruta_foto(instance, filename):
    # Nombre aleatorio: la URL no es adivinable a partir del empleado.
    return f"fotos/{uuid.uuid4().hex}.jpg"


class SituacionRevista(models.TextChoices):
    """
    Situación administrativa del agente (se carga a mano).
    El estado del día (vacaciones, licencia, ausente...) NO se guarda acá:
    se calcula a partir de las novedades vigentes.
    """

    ACTIVO = "ACTIVO", "Activo"
    SUSPENDIDO = "SUSPENDIDO", "Suspendido"
    BAJA = "BAJA", "Baja"


class EmpleadoQuerySet(models.QuerySet):
    def vigentes(self):
        """Agentes en situación de revista activa."""
        return self.filter(situacion_revista=SituacionRevista.ACTIVO)

    def con_relaciones(self):
        return self.select_related("unidad", "puesto", "modalidad")


class Empleado(TimeStampedModel):
    apellido = models.CharField("apellido", max_length=100)
    nombre = models.CharField("nombre", max_length=100)
    dni = models.CharField("DNI", max_length=9, unique=True, validators=[dni_validator])
    legajo = models.CharField(
        "legajo",
        max_length=20,
        unique=True,
        help_text="Para modalidades sin legajo propio se usa el DNI.",
    )
    fecha_nacimiento = models.DateField("fecha de nacimiento", null=True, blank=True)
    foto = models.ImageField("foto", upload_to=_ruta_foto, null=True, blank=True)

    unidad = models.ForeignKey(
        "organizacion.UnidadOrganizativa",
        verbose_name="unidad organizativa",
        on_delete=models.PROTECT,
        related_name="empleados",
        help_text="Dirección General, Dirección o Área de la que depende el agente.",
    )
    puesto = models.ForeignKey(
        "organizacion.Puesto",
        verbose_name="puesto / función",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="empleados",
    )
    modalidad = models.ForeignKey(
        "organizacion.ModalidadContratacion",
        verbose_name="modalidad de contratación",
        on_delete=models.PROTECT,
        related_name="empleados",
    )
    fecha_ingreso = models.DateField("fecha de ingreso")
    fecha_fin_contrato = models.DateField("fecha de fin de contrato", null=True, blank=True)

    telefono = models.CharField("teléfono", max_length=50, blank=True)
    email = models.EmailField("email", blank=True)

    situacion_revista = models.CharField(
        "situación de revista",
        max_length=20,
        choices=SituacionRevista.choices,
        default=SituacionRevista.ACTIVO,
    )
    fecha_baja = models.DateField("fecha de baja", null=True, blank=True)
    observaciones = models.TextField("observaciones", blank=True)

    history = HistoricalRecords()
    objects = EmpleadoQuerySet.as_manager()

    class Meta:
        verbose_name = "empleado"
        verbose_name_plural = "empleados"
        ordering = ["apellido", "nombre"]
        indexes = [models.Index(fields=["situacion_revista"])]

    def __str__(self):
        return self.nombre_completo

    @property
    def nombre_completo(self) -> str:
        return f"{self.apellido}, {self.nombre}"
