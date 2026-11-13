from datetime import date

from django.test import TestCase

from apps.core.testing import cliente, crear_empleado, datos_base
from apps.novedades.models import Novedad


class EstadoPersonalTests(TestCase):
    def setUp(self):
        self.d = datos_base()
        self.api = cliente()
        area, planta = self.d["area"], self.d["planta"]
        self.activo = crear_empleado(area, planta, 1)
        self.vacaciones = crear_empleado(area, planta, 2)
        self.medica = crear_empleado(area, planta, 3)
        self.ausente_abierto = crear_empleado(area, planta, 4)
        Novedad.objects.create(empleado=self.vacaciones, tipo=self.d["vacaciones"], fecha_desde=date(2026, 9, 10), fecha_hasta=date(2026, 9, 20), dias=7)
        Novedad.objects.create(empleado=self.medica, tipo=self.d["medica"], fecha_desde=date(2026, 9, 14), fecha_hasta=date(2026, 9, 16), dias=3)
        Novedad.objects.create(empleado=self.ausente_abierto, tipo=self.d["ausencia"], fecha_desde=date(2026, 9, 11))

    def estado(self, **params):
        respuesta = self.api.get("/api/dashboard/estado/", params)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        return respuesta.data

    def test_resumen_del_dia(self):
        datos = self.estado(desde="2026-09-15")
        resumen = datos["resumen"]
        self.assertEqual(resumen["total"], 4)
        # Sólo trabaja quien no tiene licencias vigentes.
        self.assertEqual(resumen["trabajando"], 1)
        # Resumen por artículo de licencia, con su color.
        por_tipo = {t["nombre"]: t for t in resumen["por_tipo"]}
        self.assertEqual(
            {n: por_tipo[n]["cantidad"] for n in ("Licencia vacaciones", "Licencia médica", "Ausencia", "Licencia invernal")},
            {"Licencia vacaciones": 1, "Licencia médica": 1, "Ausencia": 1, "Licencia invernal": 0},
        )
        self.assertEqual(por_tipo["Licencia médica"]["color"], self.d["medica"].color)

    def test_novedad_abierta_sigue_vigente(self):
        datos = self.estado(desde="2026-12-01")
        fila = next(e for e in datos["empleados"] if e["id"] == self.ausente_abierto.id)
        self.assertFalse(fila["trabajando"])
        self.assertIsNone(fila["novedades"][0]["hasta"])

    def test_filtro_por_estado_y_empleado(self):
        datos = self.estado(desde="2026-09-15", estado="trabajando")
        self.assertEqual({e["id"] for e in datos["empleados"]}, {self.activo.id})
        # Filtro por artículo (se combina con "trabajando")
        datos = self.estado(desde="2026-09-15", estado=f"trabajando,{self.d['medica'].id}")
        self.assertEqual({e["id"] for e in datos["empleados"]}, {self.activo.id, self.medica.id})
        datos = self.estado(desde="2026-09-15", empleado=str(self.vacaciones.id))
        self.assertEqual(len(datos["empleados"]), 1)

    def test_filtro_por_unidad_incluye_dependientes_y_personal_directo(self):
        from apps.organizacion.models import UnidadOrganizativa

        infraestructura = UnidadOrganizativa.objects.get(nombre="Dirección de Infraestructura")
        director = crear_empleado(infraestructura, self.d["planta"], 9)  # sin área, directo en la Dirección
        datos = self.estado(desde="2026-09-15", unidad=str(infraestructura.id))
        # los 4 del área Soporte (que depende de Infraestructura) + el director
        self.assertEqual(datos["resumen"]["total"], 5)
        fila = next(e for e in datos["empleados"] if e["id"] == director.id)
        self.assertEqual(fila["unidad_ruta"], "Dirección de Infraestructura")
        self.assertEqual(fila["direccion"], "Dirección de Infraestructura")
        self.assertEqual(fila["direccion_id"], infraestructura.id)
        nombres = [g["nombre"] for g in datos["grupos"]]
        self.assertEqual(nombres[1:], ["Dirección de Desarrollo", "Dirección de Infraestructura"])
        self.assertEqual(datos["grupos"][0]["tipo"], "Dirección General")
        soporte = next(e for e in datos["empleados"] if e["id"] == self.activo.id)
        self.assertEqual(soporte["unidad_ruta"], "Dirección de Infraestructura › Soporte")

    def test_grilla_periodo(self):
        respuesta = self.api.get("/api/dashboard/grilla/", {"desde": "2026-09-14", "hasta": "2026-09-18"})
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(len(respuesta.data["dias"]), 5)
        fila = next(e for e in respuesta.data["empleados"] if e["id"] == self.vacaciones.id)
        self.assertIn("2026-09-15", fila["celdas"])

    def test_consulta_puede_ver_dashboard(self):
        from apps.core.testing import ROL_CONSULTA

        api = cliente(ROL_CONSULTA)
        self.assertEqual(api.get("/api/dashboard/estado/").status_code, 200)


class GrillaNovedadAbiertaTests(TestCase):
    def test_la_novedad_abierta_no_se_proyecta_despues_de_hoy(self):
        from datetime import timedelta

        from apps.core.fechas import hoy

        d = datos_base()
        empleado = crear_empleado(d["area"], d["planta"])
        h = hoy()
        Novedad.objects.create(empleado=empleado, tipo=d["ausencia"], fecha_desde=h - timedelta(days=2))
        r = cliente().get("/api/dashboard/grilla/", {"desde": str(h - timedelta(days=2)), "hasta": str(h + timedelta(days=3))})
        celdas = r.data["empleados"][0]["celdas"]
        self.assertIn(str(h), celdas)
        self.assertNotIn(str(h + timedelta(days=1)), celdas)


class CumpleaniosTests(TestCase):
    def test_marca_el_cumpleanios_del_dia_mirado(self):
        d = datos_base()
        cumple = crear_empleado(d["area"], d["planta"], 1, fecha_nacimiento=date(1990, 9, 15))
        otro = crear_empleado(d["area"], d["planta"], 2, fecha_nacimiento=date(1990, 9, 16))
        api = cliente()
        filas = {e["id"]: e for e in api.get("/api/dashboard/estado/", {"desde": "2026-09-15"}).data["empleados"]}
        self.assertEqual((filas[cumple.id]["cumpleanios"], filas[otro.id]["cumpleanios"]), (True, False))
        self.assertNotIn("fecha_nacimiento", filas[cumple.id])
        # En un período no se marca
        filas = api.get("/api/dashboard/estado/", {"desde": "2026-09-14", "hasta": "2026-09-20"}).data["empleados"]
        self.assertFalse(any(e["cumpleanios"] for e in filas))

    def test_29_de_febrero(self):
        from .services import es_cumpleanios

        nacimiento = date(2000, 2, 29)
        self.assertTrue(es_cumpleanios(nacimiento, date(2027, 2, 28)))
        self.assertFalse(es_cumpleanios(nacimiento, date(2028, 2, 28)))
        self.assertTrue(es_cumpleanios(nacimiento, date(2028, 2, 29)))


class EtiquetaArticuloTests(TestCase):
    def test_etiqueta_obligatoria_y_en_el_resumen_de_la_tarjeta(self):
        d = datos_base()
        api = cliente()
        r = api.post("/api/novedades/tipos/", {"nombre": "Art. 36 - Día de cumpleaños", "etiqueta": "  "}, format="json")
        self.assertIn("etiqueta", r.data)
        r = api.post("/api/novedades/tipos/", {"nombre": "Art. 36 - Día de cumpleaños", "etiqueta": "ART.36"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        empleado = crear_empleado(d["area"], d["planta"])
        Novedad.objects.create(empleado=empleado, tipo_id=r.data["id"], fecha_desde=date(2026, 9, 15), fecha_hasta=date(2026, 9, 15), dias=1)
        fila = api.get("/api/dashboard/estado/", {"desde": "2026-09-15"}).data["empleados"][0]
        self.assertEqual((fila["novedades"][0]["etiqueta"], fila["novedades"][0]["tipo"]), ("ART.36", "Art. 36 - Día de cumpleaños"))


class HorarioEInactivosTests(TestCase):
    """Al mirar hoy, quien no tiene licencias pero está fuera de su horario figura Inactivo."""

    def setUp(self):
        from datetime import time

        from apps.organizacion.models import Cargo

        self.d = datos_base()
        self.api = cliente()
        self.temprano = crear_empleado(self.d["area"], self.d["planta"], 1, hora_entrada=time(7, 0), hora_salida=time(13, 0))
        self.normal = crear_empleado(self.d["area"], self.d["planta"], 2, cargo=Cargo.objects.create(nombre="JEFE"))
        self.con_licencia = crear_empleado(self.d["area"], self.d["planta"], 3)

    def estado(self, dia, hora, **params):
        """Consulta el Inicio simulando que hoy es `dia` a la hora `hora`."""
        from datetime import datetime, time
        from unittest import mock

        from django.utils import timezone

        ahora = timezone.make_aware(datetime.combine(dia, time(*hora)))
        Novedad.objects.get_or_create(empleado=self.con_licencia, tipo=self.d["medica"], fecha_desde=dia, fecha_hasta=dia, defaults={"dias": 1})
        with mock.patch("apps.dashboard.services.hoy", return_value=dia), mock.patch(
            "apps.dashboard.services.timezone.localtime", return_value=ahora
        ):
            return self.api.get("/api/dashboard/estado/", {"desde": dia.isoformat(), **params}).data

    def test_dentro_y_fuera_de_horario(self):
        lunes = date(2026, 9, 14)
        datos = self.estado(lunes, (14, 0))  # 14:00: el de 7 a 13 ya se fue
        filas = {e["id"]: e for e in datos["empleados"]}
        self.assertEqual((filas[self.temprano.id]["en_horario"], filas[self.normal.id]["en_horario"]), (False, True))
        self.assertEqual((filas[self.temprano.id]["horario"], filas[self.normal.id]["cargo"]), ("07:00 a 13:00", "JEFE"))
        resumen = datos["resumen"]
        self.assertEqual((resumen["total"], resumen["trabajando"], resumen["inactivos"], resumen["no_trabajando"]), (3, 1, 1, 1))
        self.assertTrue(datos["es_hoy"])
        # Filtros de estado
        ids = lambda estado: {e["id"] for e in self.estado(lunes, (14, 0), estado=estado)["empleados"]}
        self.assertEqual(ids("trabajando"), {self.normal.id})
        self.assertEqual(ids("inactivo"), {self.temprano.id})

    def test_fin_de_semana_todos_inactivos(self):
        sabado = date(2026, 9, 19)
        resumen = self.estado(sabado, (10, 0))["resumen"]
        self.assertEqual((resumen["trabajando"], resumen["inactivos"]), (0, 2))

    def test_otra_fecha_no_aplica_horario(self):
        datos = self.api.get("/api/dashboard/estado/", {"desde": "2026-09-15"}).data
        self.assertIsNone(datos["resumen"]["inactivos"])
        self.assertTrue(all(e["en_horario"] is None for e in datos["empleados"]))
        self.assertEqual(datos["resumen"]["trabajando"], 3)

    def test_unidad_corta_en_la_tarjeta(self):
        from apps.organizacion.models import UnidadOrganizativa

        infra = UnidadOrganizativa.objects.get(nombre="Dirección de Infraestructura")
        depto = UnidadOrganizativa.objects.create(nombre="DEPARTAMENTO DE SOPORTE TÉCNICO", tipo="AREA", padre=infra)
        en_depto = crear_empleado(depto, self.d["planta"], 8)
        directo = crear_empleado(infra, self.d["planta"], 9)
        filas = {e["id"]: e for e in self.api.get("/api/dashboard/estado/", {"desde": "2026-09-15"}).data["empleados"]}
        self.assertEqual((filas[en_depto.id]["unidad_corta"], filas[en_depto.id]["unidad"]), ("SOPORTE TÉCNICO", "DEPARTAMENTO DE SOPORTE TÉCNICO"))
        # Quien depende directo de una dirección también muestra su unidad
        self.assertEqual((filas[directo.id]["unidad_corta"], filas[directo.id]["unidad"]), ("Infraestructura", "Dirección de Infraestructura"))
        self.assertEqual(filas[en_depto.id]["nombre_tarjeta"], "Apellido8, Nombre8")
