"""
Carga datos ficticios para desarrollo y demostración.
NO usar en producción: crea usuarios con contraseñas conocidas.
"""
import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.roles import ROL_ADMINISTRADOR, ROL_CONSULTA
from apps.calendario.services import contar_dias
from apps.core.fechas import hoy
from apps.novedades.models import Novedad, TipoNovedad
from apps.organizacion import seeds as seeds_organizacion
from apps.organizacion.models import ModalidadContratacion, Puesto, TipoUnidad, UnidadOrganizativa
from apps.personal.models import Empleado
from apps.vacaciones.models import ConceptoMovimiento, MovimientoSaldo

# Área -> Dirección de la que depende
AREAS = {
    "Soporte técnico": "Dirección de Infraestructura",
    "Desarrollo": "Dirección de Desarrollo",
    "Redes e infraestructura": "Dirección de Infraestructura",
    "Administración": "Dirección de Infraestructura",
}
PUESTOS = ["Director/a", "Jefe/a de área", "Técnico/a de soporte", "Desarrollador/a", "Administrador/a de redes", "Administrativo/a"]
NOMBRES = ["Lucía", "Martín", "Sofía", "Juan", "Valentina", "Diego", "Camila", "Nicolás", "Florencia", "Matías",
           "Agustina", "Federico", "Julieta", "Pablo", "Micaela", "Santiago", "Carolina", "Tomás", "Rocío", "Gonzalo",
           "Paula", "Facundo", "Belén", "Ezequiel"]
APELLIDOS = ["Fernández", "González", "Rodríguez", "López", "Martínez", "Pérez", "Gómez", "Díaz", "Sánchez", "Romero",
             "Sosa", "Álvarez", "Torres", "Ruiz", "Ramírez", "Flores", "Acosta", "Benítez", "Medina", "Herrera",
             "Aguirre", "Pereyra", "Gutiérrez", "Giménez"]


class Command(BaseCommand):
    help = "Carga datos de demostración (áreas, empleados, novedades, saldos y usuarios admin/consulta)."

    def add_arguments(self, parser):
        parser.add_argument("--forzar", action="store_true", help="Cargar aunque ya existan empleados.")

    @transaction.atomic
    def handle(self, *args, **options):
        if Empleado.objects.exists() and not options["forzar"]:
            raise CommandError("Ya existen empleados. Use --forzar para cargar igualmente.")
        call_command("inicializar", stdout=self.stdout)
        rnd = random.Random(42)
        fecha_hoy = hoy()

        direccion_general = seeds_organizacion.raiz()
        areas = [
            UnidadOrganizativa.objects.get_or_create(
                nombre=n,
                padre=UnidadOrganizativa.objects.get(nombre=d, padre=direccion_general),
                defaults={"orden": i, "tipo": TipoUnidad.AREA},
            )[0]
            for i, (n, d) in enumerate(AREAS.items())
        ]
        # Personal que depende directamente de la Dirección General o de una Dirección (sin área).
        asignacion_directa = {
            0: direccion_general,
            14: UnidadOrganizativa.objects.get(nombre="Dirección de Desarrollo", padre=direccion_general),
            15: UnidadOrganizativa.objects.get(nombre="Dirección de Infraestructura", padre=direccion_general),
        }
        puestos = [Puesto.objects.get_or_create(nombre=n, defaults={"orden": i})[0] for i, n in enumerate(PUESTOS)]
        modalidades = list(ModalidadContratacion.objects.all())

        empleados = []
        for i, (nombre, apellido) in enumerate(zip(NOMBRES, APELLIDOS)):
            modalidad = modalidades[0] if i % 3 == 0 else rnd.choice(modalidades)
            dni = str(25_000_000 + i * 713_417)
            ingreso = fecha_hoy - timedelta(days=rnd.randint(200, 5000))
            empleados.append(
                Empleado.objects.create(
                    apellido=apellido,
                    nombre=nombre,
                    dni=dni,
                    legajo=dni if modalidad.usa_dni_como_legajo else str(1000 + i),
                    fecha_nacimiento=fecha_hoy - timedelta(days=rnd.randint(22 * 365, 60 * 365)),
                    unidad=asignacion_directa.get(i, areas[i % len(areas)]),
                    puesto=rnd.choice(puestos),
                    modalidad=modalidad,
                    fecha_ingreso=ingreso,
                    fecha_fin_contrato=fecha_hoy.replace(month=12, day=31) if modalidad.requiere_fecha_fin else None,
                    telefono=f"2901-4{rnd.randint(10000, 99999)}",
                    email=f"{nombre.lower()}.{apellido.lower()}@ushuaia.gob.ar".translate(str.maketrans("áéíóú", "aeiou")),
                )
            )

        vacaciones = TipoNovedad.objects.get(nombre="Licencia vacaciones")
        tipos = {t.nombre: t for t in TipoNovedad.objects.all()}
        for emp in empleados:
            MovimientoSaldo.objects.create(
                empleado=emp, tipo_novedad=vacaciones, concepto=ConceptoMovimiento.ASIGNACION,
                anio=fecha_hoy.year - 1, dias=rnd.choice([0, 3, 5, 8]) or 2, fecha=fecha_hoy.replace(month=1, day=2),
                motivo="Saldo remanente año anterior",
            )
            MovimientoSaldo.objects.create(
                empleado=emp, tipo_novedad=vacaciones, concepto=ConceptoMovimiento.ASIGNACION,
                anio=fecha_hoy.year, dias=rnd.choice([15, 20, 25]), fecha=fecha_hoy.replace(month=1, day=2),
                motivo=f"Asignación {fecha_hoy.year}",
            )
        MovimientoSaldo.objects.create(
            empleado=empleados[1], tipo_novedad=vacaciones, concepto=ConceptoMovimiento.COMPENSACION,
            anio=fecha_hoy.year, dias=1, fecha=fecha_hoy - timedelta(days=20),
            fecha_trabajada=fecha_hoy - timedelta(days=24), motivo="Migración de servidores en fin de semana",
        )

        def novedad(emp, tipo, desde_offset, duracion, motivo=""):
            desde = fecha_hoy + timedelta(days=desde_offset)
            hasta = desde + timedelta(days=duracion - 1) if duracion else None
            Novedad.objects.create(
                empleado=emp, tipo=tipos[tipo], fecha_desde=desde, fecha_hasta=hasta, motivo=motivo,
                dias=contar_dias(desde, hasta, tipos[tipo].computo_dias) if hasta else None,
            )

        # Situación actual variada para el dashboard
        novedad(empleados[1], "Licencia vacaciones", -3, 10)
        novedad(empleados[2], "Licencia vacaciones", -1, 14)
        novedad(empleados[3], "Licencia médica", -2, 5, "Gripe")
        novedad(empleados[4], "Ausencia", 0, None, "Sin aviso")
        novedad(empleados[5], "Comisión de servicio", -1, 3, "Capacitación en Río Grande")
        novedad(empleados[6], "Licencia invernal", -4, 7)
        novedad(empleados[7], "Licencia médica", -10, None, "Tratamiento prolongado")
        # Futuras y pasadas
        novedad(empleados[8], "Licencia vacaciones", 7, 10)
        novedad(empleados[9], "Licencia vacaciones", 12, 7)
        novedad(empleados[10], "Licencia vacaciones", 15, 14)
        novedad(empleados[11], "Licencia vacaciones", -60, 10)
        novedad(empleados[12], "Licencia médica", -30, 2, "Control médico")
        novedad(empleados[13], "Ausencia", -15, 1, "Trámite personal")
        novedad(empleados[0], "Licencia vacaciones", -120, 15)

        User = get_user_model()
        admin, _ = User.objects.get_or_create(username="admin", defaults={"first_name": "Administrador", "is_staff": True, "is_superuser": True})
        admin.set_password("Admin.2026")
        admin.save()
        admin.groups.add(Group.objects.get(name=ROL_ADMINISTRADOR))
        consulta, _ = User.objects.get_or_create(username="consulta", defaults={"first_name": "Usuario", "last_name": "Consulta"})
        consulta.set_password("Consulta.2026")
        consulta.save()
        consulta.groups.add(Group.objects.get(name=ROL_CONSULTA))

        self.stdout.write(self.style.SUCCESS(f"Demo cargada: {len(empleados)} empleados."))
        self.stdout.write("Usuarios: admin / Admin.2026  —  consulta / Consulta.2026")
