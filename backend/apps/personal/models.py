import uuid
from datetime import time

from django.core.validators import RegexValidator
from django.db import models
from simple_history.models import HistoricalRecords

from apps.core.models import TimeStampedModel

dni_validator = RegexValidator(r"^\d{7,9}$", "El DNI debe tener entre 7 y 9 dígitos, sin puntos.")


def _ruta_foto(instance, filename):
    # Ya no se usa (las fotos se quitaron); se conserva porque la importa la migración 0005.
    return f"fotos/{uuid.uuid4().hex}.jpg"


# Partículas que forman parte del apellido siguiente ("DE LA CRUZ", "DEL VALLE", "SAN MARTÍN").
_PARTICULAS = {"de", "del", "la", "las", "los", "da", "di", "do", "dos", "van", "von", "san", "santa", "mc", "mac"}


def _primer_termino(texto: str) -> str:
    """Primer apellido o nombre, sin partir los que empiezan con partícula: "DE LA CRUZ PÉREZ" → "DE LA CRUZ"."""
    palabras = texto.split()
    tomadas = []
    for palabra in palabras:
        tomadas.append(palabra)
        if palabra.lower() not in _PARTICULAS:
            break
    return " ".join(tomadas)


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
        return self.select_related("unidad", "modalidad", "cargo").prefetch_related("adicionales")


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
    etiqueta = models.CharField(
        "etiqueta",
        max_length=60,
        blank=True,
        help_text="Nombre para la tarjeta del Inicio. Vacío = primer apellido y primer nombre.",
    )
    # Obligatoria en el formulario; admite vacío sólo por los registros anteriores.
    fecha_nacimiento = models.DateField("fecha de nacimiento", null=True, blank=True)
    cuit = models.CharField("CUIT", max_length=11, blank=True, help_text="11 dígitos, sin guiones.")
    titulo = models.CharField("título", max_length=160, blank=True)

    unidad = models.ForeignKey(
        "organizacion.UnidadOrganizativa",
        verbose_name="unidad organizativa",
        on_delete=models.PROTECT,
        related_name="empleados",
        help_text="Dirección General, Dirección o Área de la que depende el agente.",
    )
    modalidad = models.ForeignKey(
        "organizacion.ModalidadContratacion",
        verbose_name="modalidad de contratación",
        on_delete=models.PROTECT,
        related_name="empleados",
    )
    fecha_ingreso = models.DateField("fecha de ingreso")
    fecha_fin_contrato = models.DateField("fecha de fin de contrato", null=True, blank=True)
    numero_proveedor = models.CharField("número de proveedor", max_length=30, blank=True)
    # Horario habitual (lunes a viernes): fuera de él la tarjeta del Inicio lo muestra "Inactivo".
    hora_entrada = models.TimeField("hora de entrada", default=time(8, 0))
    hora_salida = models.TimeField("hora de salida", default=time(15, 0))
    cargo = models.ForeignKey(
        "organizacion.Cargo", verbose_name="cargo", on_delete=models.PROTECT, null=True, blank=True, related_name="empleados"
    )
    cargo_acto_administrativo = models.CharField(
        "acto administrativo del cargo", max_length=120, blank=True, help_text="Por ejemplo: Resolución 109-2026."
    )
    adicionales = models.ManyToManyField("organizacion.Adicional", verbose_name="adicionales", blank=True, related_name="empleados")

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

    # Los adicionales (M2M) también quedan en el historial de cambios.
    history = HistoricalRecords(m2m_fields=[adicionales])
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

    @property
    def nombre_tarjeta(self) -> str:
        """Nombre corto para la tarjeta del Inicio: la etiqueta o "PRIMER_APELLIDO, PRIMER_NOMBRE"."""
        if self.etiqueta:
            return self.etiqueta
        return f"{_primer_termino(self.apellido)}, {_primer_termino(self.nombre)}".strip(", ")

    @property
    def horario(self) -> str:
        return f"{self.hora_entrada:%H:%M} a {self.hora_salida:%H:%M}"

    def en_horario(self, hora: time) -> bool:
        """La hora cae dentro del horario habitual (admite horarios que cruzan la medianoche)."""
        if self.hora_entrada <= self.hora_salida:
            return self.hora_entrada <= hora < self.hora_salida
        return hora >= self.hora_entrada or hora < self.hora_salida
