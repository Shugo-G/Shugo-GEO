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


class FotoEmpleadoTests(TestCase):
    def setUp(self):
        import tempfile

        from django.test import override_settings

        self.media = tempfile.TemporaryDirectory()
        self.override = override_settings(MEDIA_ROOT=self.media.name)
        self.override.enable()
        self.d = datos_base()
        self.api = cliente()
        self.empleado = crear_empleado(self.d["area"], self.d["planta"])
        self.url = f"/api/personal/empleados/{self.empleado.id}/foto/"

    def tearDown(self):
        self.override.disable()
        self.media.cleanup()

    def imagen(self, formato="PNG", tamanio=(900, 600)):
        from io import BytesIO

        from django.core.files.uploadedfile import SimpleUploadedFile
        from PIL import Image

        buffer = BytesIO()
        Image.new("RGB", tamanio, (200, 30, 30)).save(buffer, format=formato)
        return SimpleUploadedFile(f"foto.{formato.lower()}", buffer.getvalue(), content_type=f"image/{formato.lower()}")

    def test_carga_normaliza_y_reemplaza(self):
        from PIL import Image

        r = self.api.post(self.url, {"foto": self.imagen()}, format="multipart")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(r.data["foto_url"].startswith("/media/fotos/"))
        self.empleado.refresh_from_db()
        primera = self.empleado.foto.path
        with Image.open(primera) as im:
            self.assertEqual((im.format, im.size), ("JPEG", (400, 400)))

        self.api.post(self.url, {"foto": self.imagen("JPEG")}, format="multipart")
        self.empleado.refresh_from_db()
        import os

        self.assertFalse(os.path.exists(primera))  # la anterior se borra

    def test_rechaza_archivo_que_no_es_imagen_y_permite_quitar(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        r = self.api.post(self.url, {"foto": SimpleUploadedFile("x.png", b"no es imagen")}, format="multipart")
        self.assertEqual(r.status_code, 400)
        self.api.post(self.url, {"foto": self.imagen()}, format="multipart")
        r = self.api.delete(self.url)
        self.assertEqual((r.status_code, r.data["foto_url"]), (200, None))

    def test_consulta_no_puede_cargar_fotos(self):
        from apps.core.testing import ROL_CONSULTA

        r = cliente(ROL_CONSULTA).post(self.url, {"foto": self.imagen()}, format="multipart")
        self.assertEqual(r.status_code, 403)
