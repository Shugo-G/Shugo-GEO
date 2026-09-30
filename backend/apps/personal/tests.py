from django.test import TestCase

from apps.core.testing import cliente, crear_empleado, datos_base


class EmpleadoTests(TestCase):
    def setUp(self):
        self.d = datos_base()
        self.api = cliente()

    def payload(self, **extra):
        datos = {
            "apellido": "Pérez",
            "nombre": "Ana",
            "dni": "30111222",
            "unidad": self.d["area"].id,
            "modalidad": self.d["planta"].id,
            "fecha_ingreso": "2024-03-01",
        }
        datos.update(extra)
        return datos

    def test_planta_requiere_legajo(self):
        respuesta = self.api.post("/api/personal/empleados/", self.payload(), format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("legajo", respuesta.data)

    def test_pasante_usa_dni_como_legajo_y_requiere_fin_de_contrato(self):
        respuesta = self.api.post("/api/personal/empleados/", self.payload(modalidad=self.d["pasante"].id), format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("fecha_fin_contrato", respuesta.data)

        respuesta = self.api.post(
            "/api/personal/empleados/",
            self.payload(modalidad=self.d["pasante"].id, fecha_fin_contrato="2026-12-31"),
            format="json",
        )
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data["legajo"], "30111222")

    def test_legajo_unico(self):
        crear_empleado(self.d["area"], self.d["planta"], legajo="500")
        respuesta = self.api.post("/api/personal/empleados/", self.payload(legajo="500"), format="json")
        self.assertEqual(respuesta.status_code, 400)

    def test_ficha_e_historial(self):
        empleado = crear_empleado(self.d["area"], self.d["planta"])
        self.api.patch(f"/api/personal/empleados/{empleado.id}/", {"telefono": "2901-123456"}, format="json")
        ficha = self.api.get(f"/api/personal/empleados/{empleado.id}/ficha/").data
        self.assertTrue(ficha["situacion_actual"]["trabajando"])
        self.assertEqual(len(ficha["saldos"]), 1)
        historial = self.api.get(f"/api/personal/empleados/{empleado.id}/historial/").data
        self.assertEqual(historial[0]["tipo"], "Modificación")
        self.assertEqual(historial[0]["cambios"][0]["nuevo"], "2901-123456")

    def test_asignar_empleado_directo_a_la_direccion_general(self):
        from apps.organizacion.models import TipoUnidad, UnidadOrganizativa

        dg = UnidadOrganizativa.objects.get(tipo=TipoUnidad.DIRECCION_GENERAL)
        respuesta = self.api.post("/api/personal/empleados/", self.payload(unidad=dg.id, legajo="900"), format="json")
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data["unidad_tipo"], "Dirección General")
        self.assertEqual(respuesta.data["unidad_ruta"], dg.nombre)
