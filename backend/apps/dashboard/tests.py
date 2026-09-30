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
