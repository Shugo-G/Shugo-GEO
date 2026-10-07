"""
Carga datos ficticios para desarrollo y demostración.
NO usar en producción: crea usuarios con contraseñas conocidas.

Arma una instalación chica pero completa: estructura (Dirección General, dos
direcciones y sus áreas), 12 agentes, saldos por año, licencias en distintos
estados, cargos patrimoniales y servicios contratados.
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
from apps.organizacion.models import ModalidadContratacion, TipoUnidad, UnidadOrganizativa
from apps.patrimonio.models import CargoPatrimonial, TipoInsumo
from apps.patrimonio.services import dar_de_baja, transferir
from apps.personal.models import Empleado
from apps.servicios.models import EstadoLinea, LineaMovil, Proveedor, ServicioInternet, TipoSim
from apps.vacaciones.models import ConceptoMovimiento, MovimientoSaldo

# Dirección -> áreas que dependen de ella
ESTRUCTURA = {
    "Dirección de Desarrollo": ["Desarrollo"],
    "Dirección de Infraestructura": ["Soporte técnico", "Redes e infraestructura"],
}

# apellido, nombre, unidad ("DG" = Dirección General, o nombre de dirección/área)
PERSONAL = [
    ("Fernández", "Lucía", "DG"),
    ("González", "Martín", "Dirección de Desarrollo"),
    ("Rodríguez", "Sofía", "Desarrollo"),
    ("López", "Juan", "Desarrollo"),
    ("Martínez", "Valentina", "Desarrollo"),
    ("Pérez", "Diego", "Dirección de Infraestructura"),
    ("Gómez", "Camila", "Soporte técnico"),
    ("Díaz", "Nicolás", "Soporte técnico"),
    ("Sánchez", "Florencia", "Soporte técnico"),
    ("Romero", "Matías", "Redes e infraestructura"),
    ("Acosta", "Carolina", "Redes e infraestructura"),
    ("Benítez", "Tomás", "DG"),
]
# Modalidad de cada agente (índice en el orden de las modalidades): mayoría planta
# permanente, algunos contratos (legajo = DNI) y un pasante.
MODALIDAD = [0, 0, 1, 0, 0, 0, 2, 1, 0, 0, 3, 0]


class Command(BaseCommand):
    help = "Carga datos de demostración (estructura, 12 agentes, licencias, saldos, patrimonio, servicios y usuarios)."

    def add_arguments(self, parser):
        parser.add_argument("--forzar", action="store_true", help="Cargar aunque ya existan empleados.")

    @transaction.atomic
    def handle(self, *args, **options):
        if Empleado.objects.exists() and not options["forzar"]:
            raise CommandError("Ya existen empleados. Use --forzar para cargar igualmente.")
        call_command("inicializar", stdout=self.stdout)
        rnd = random.Random(42)
        self.fecha_hoy = hoy()
        self.anio = self.fecha_hoy.year
        self.admin = self._usuarios()

        unidades = self._estructura()
        empleados = self._personal(unidades, rnd)
        self._saldos_y_licencias(empleados, rnd)
        self._patrimonio(empleados)
        self._servicios()

        self.stdout.write(self.style.SUCCESS(f"Demo cargada: {len(empleados)} empleados."))
        self.stdout.write("Usuarios: admin / Admin.2026  —  consulta / Consulta.2026")

    # ------------------------------------------------------------------
    def _usuarios(self):
        User = get_user_model()
        admin, _ = User.objects.get_or_create(
            username="admin", defaults={"first_name": "Administrador", "is_staff": True, "is_superuser": True}
        )
        admin.set_password("Admin.2026")
        admin.save()
        admin.groups.add(Group.objects.get(name=ROL_ADMINISTRADOR))
        consulta, _ = User.objects.get_or_create(username="consulta", defaults={"first_name": "Usuario", "last_name": "Consulta"})
        consulta.set_password("Consulta.2026")
        consulta.save()
        consulta.groups.add(Group.objects.get(name=ROL_CONSULTA))
        return admin

    def _estructura(self) -> dict[str, UnidadOrganizativa]:
        dg = seeds_organizacion.raiz()
        unidades = {"DG": dg}
        for orden, (direccion, areas) in enumerate(ESTRUCTURA.items(), start=1):
            d, _ = UnidadOrganizativa.objects.get_or_create(
                padre=dg, nombre=direccion, defaults={"tipo": TipoUnidad.DIRECCION, "orden": orden}
            )
            unidades[direccion] = d
            for i, area in enumerate(areas, start=1):
                unidades[area], _ = UnidadOrganizativa.objects.get_or_create(
                    padre=d, nombre=area, defaults={"tipo": TipoUnidad.AREA, "orden": i}
                )
        return unidades

    def _personal(self, unidades, rnd) -> list[Empleado]:
        modalidades = list(ModalidadContratacion.objects.order_by("orden"))
        empleados = []
        for i, (apellido, nombre, unidad) in enumerate(PERSONAL):
            modalidad = modalidades[min(MODALIDAD[i], len(modalidades) - 1)]
            dni = str(25_000_000 + i * 713_417)
            empleados.append(
                Empleado.objects.create(
                    apellido=apellido,
                    nombre=nombre,
                    dni=dni,
                    legajo=dni if modalidad.usa_dni_como_legajo else str(1000 + i),
                    fecha_nacimiento=self.fecha_hoy - timedelta(days=rnd.randint(24 * 365, 58 * 365)),
                    unidad=unidades[unidad],
                    modalidad=modalidad,
                    fecha_ingreso=self.fecha_hoy - timedelta(days=rnd.randint(400, 5000)),
                    fecha_fin_contrato=self.fecha_hoy.replace(month=12, day=31) if modalidad.requiere_fecha_fin else None,
                    telefono=f"2901-4{rnd.randint(10000, 99999)}",
                    email=f"{nombre.lower()}.{apellido.lower()}@ushuaia.gob.ar".translate(str.maketrans("áéíóú", "aeiou")),
                )
            )
        return empleados

    def _saldos_y_licencias(self, empleados, rnd):
        tipos = {t.nombre: t for t in TipoNovedad.objects.all()}
        vacaciones = tipos["Licencia vacaciones"]
        # Demostración de "saldo por año": vacaciones (y la invernal, que comparte su bolsa)
        # tienen una bolsa por año: el remanente del año anterior y la asignación del actual.
        vacaciones.saldo_por_anio = True
        vacaciones.save()

        anterior, actual = self.anio - 1, self.anio
        for emp in empleados:
            self._movimiento(emp, vacaciones, anterior, rnd.choice([4, 6, 8]), "Saldo remanente")
            self._movimiento(emp, vacaciones, actual, rnd.choice([20, 25]), f"Asignación {actual}")
        # Licencia invernal: acreditada al año actual (va a la bolsa de vacaciones de ese año).
        for emp in empleados:
            self._movimiento(emp, tipos["Licencia invernal"], actual, 10, f"Licencia invernal {actual}")
        MovimientoSaldo.objects.create(
            empleado=empleados[2], tipo_novedad=vacaciones, concepto=ConceptoMovimiento.COMPENSACION,
            anio=actual, dias=1, fecha=self.fecha_hoy - timedelta(days=20),
            fecha_trabajada=self.fecha_hoy - timedelta(days=24), motivo="Migración de servidores en fin de semana",
            creado_por=self.admin,
        )

        def licencia(emp, tipo, desde_offset, duracion, motivo="", anio=None):
            t = tipos[tipo]
            desde = self.fecha_hoy + timedelta(days=desde_offset)
            hasta = desde + timedelta(days=duracion - 1) if duracion else None
            Novedad.objects.create(
                empleado=emp, tipo=t, fecha_desde=desde, fecha_hasta=hasta, motivo=motivo,
                dias=contar_dias(desde, hasta, t.computo_dias) if hasta else None,
                anio_saldo=anio if t.saldo_anual else None, creado_por=self.admin,
            )

        # Situación de hoy, variada para el Inicio
        licencia(empleados[3], "Licencia vacaciones", -3, 10, anio=actual)
        licencia(empleados[6], "Licencia médica", -2, 5, "Gripe")
        licencia(empleados[7], "Ausencia", 0, None, "Sin aviso")
        licencia(empleados[9], "Licencia invernal", -1, 5, anio=actual)
        licencia(empleados[10], "Licencia médica", -10, None, "Tratamiento prolongado")
        # Programadas
        licencia(empleados[4], "Licencia vacaciones", 7, 10, anio=actual)
        licencia(empleados[8], "Licencia vacaciones", 15, 5, anio=anterior)
        licencia(empleados[1], "Licencia invernal", 20, 5, anio=actual)
        # Pasadas (historial)
        licencia(empleados[5], "Licencia vacaciones", -60, 5, anio=anterior)
        licencia(empleados[0], "Licencia vacaciones", -120, 10, anio=actual)
        licencia(empleados[11], "Licencia médica", -30, 2, "Control médico")
        licencia(empleados[2], "Ausencia", -15, 1, "Trámite personal")

    def _movimiento(self, emp, tipo, anio, dias, motivo):
        MovimientoSaldo.objects.create(
            empleado=emp, tipo_novedad=tipo, concepto=ConceptoMovimiento.ASIGNACION, anio=anio, dias=dias,
            fecha=self.fecha_hoy.replace(month=1, day=2), motivo=motivo, creado_por=self.admin,
        )

    def _patrimonio(self, empleados):
        insumo = {t.nombre: t for t in TipoInsumo.objects.all()}
        inicio = self.fecha_hoy - timedelta(days=300)

        def cargo(emp, tipo, iub, planilla, descripcion):
            return CargoPatrimonial.objects.create(
                empleado=emp, tipo_insumo=insumo[tipo], iub=iub, planilla_cargo=planilla,
                descripcion=descripcion, fecha_asignacion=inicio, creado_por=self.admin,
            )

        cargo(empleados[0], "NOTEBOOK", "0000040445", "PC-101", "Notebook Lenovo ThinkPad E14")
        cargo(empleados[2], "CPU", "0000040512", "PC-102", "Dell OptiPlex 7090")
        cargo(empleados[2], "MONITOR", "0000040513", "PC-102", "Monitor Samsung 24\"")
        cargo(empleados[9], "ROUTER", "0000041020", "PC-110", "MikroTik RB4011")
        movido = cargo(empleados[6], "NOTEBOOK", "0000040777", "PC-120", "Notebook HP ProBook 440")
        transferir(movido, self.fecha_hoy - timedelta(days=40), empleado=empleados[8], planilla_cargo="PC-131",
                   motivo="Reasignación de equipo", usuario=self.admin)
        roto = cargo(empleados[7], "MONITOR", "0000039901", "PC-095", "Monitor LG 19\"")
        dar_de_baja(roto, self.fecha_hoy - timedelta(days=15), "Pantalla dañada")

    def _servicios(self):
        proveedor = {p.nombre: p for p in Proveedor.objects.all()}
        estado = {e.nombre: e for e in EstadoLinea.objects.all()}
        sim = {s.nombre: s for s in TipoSim.objects.all()}
        for numero, sim_n, tipo, prov, est, responsable, area, secretaria in (
            ("2901-555101", "8954310000000000101", "SIM físico", "Claro", "Activa", "Fernández, Lucía", "Dirección General de Informática", "Secretaría de Gobierno"),
            ("2901-555102", "8954310000000000102", "SIM virtual", "Claro", "Activa", "Guardia de soporte", "Soporte técnico", "Secretaría de Gobierno"),
            ("2901-555233", "8954070000000000233", "SIM físico", "Telefónica", "Suspendida", "Mesa de entradas", "Despacho", "Secretaría de Hacienda"),
        ):
            LineaMovil.objects.create(
                numero=numero, numero_sim=sim_n, tipo_sim=sim.get(tipo), proveedor=proveedor[prov], estado=estado[est],
                responsable=responsable, area=area, secretaria=secretaria, creado_por=self.admin,
            )
        ServicioInternet.objects.create(
            sitio="Edificio central", direccion="San Martín 660", proveedor=proveedor["Ushuaia Visión"],
            numero_cliente="UV-20931", numero_fsan="ALCLF1234567", velocidad="500 Mbps", ip_publica="200.0.113.10",
            creado_por=self.admin,
        )
        ServicioInternet.objects.create(
            sitio="Centro de cómputos", direccion="Maipú 505", proveedor=proveedor["Supercanal"],
            numero_cliente="SC-88412", numero_fsan="HWTC9876543", velocidad="300 Mbps", ip_publica="200.0.113.42",
            creado_por=self.admin,
        )
