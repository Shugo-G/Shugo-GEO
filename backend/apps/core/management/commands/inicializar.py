from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.roles import configurar_roles
from apps.calendario.services import cargar_feriados_nacionales
from apps.core.fechas import hoy
from apps.novedades import seeds as seeds_novedades
from apps.organizacion import seeds as seeds_organizacion
from apps.patrimonio import seeds as seeds_patrimonio
from apps.servicios import seeds as seeds_servicios

# Seeds de cada módulo, en orden de dependencia. Un módulo nuevo agrega el suyo acá.
SEEDS = [
    ("Modalidades de contratación", seeds_organizacion.cargar),
    ("Artículos de licencia", seeds_novedades.cargar),
    ("Categorías de insumo", seeds_patrimonio.cargar),
    ("Categorías de servicios", seeds_servicios.cargar),
]


class Command(BaseCommand):
    help = "Configura roles, catálogos iniciales y feriados nacionales. Se puede ejecutar varias veces."

    def add_arguments(self, parser):
        parser.add_argument("--anios", nargs="*", type=int, help="Años de feriados a cargar (por defecto actual y siguiente).")

    @transaction.atomic
    def handle(self, *args, **options):
        roles = configurar_roles()
        self.stdout.write(self.style.SUCCESS(f"Roles configurados: {', '.join(roles)}"))

        for descripcion, cargar in SEEDS:
            cargar()
            self.stdout.write(self.style.SUCCESS(f"{descripcion}: OK"))

        anio = hoy().year
        for a in options["anios"] or [anio, anio + 1]:
            creados, existentes = cargar_feriados_nacionales(a)
            self.stdout.write(self.style.SUCCESS(f"Feriados {a}: {creados} nuevos, {existentes} ya existentes"))
