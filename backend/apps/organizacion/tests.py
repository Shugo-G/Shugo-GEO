from django.test import TestCase

from apps.core.testing import cliente, crear_empleado, datos_base

from .models import TipoUnidad, UnidadOrganizativa
from .selectors import Arbol


class EstructuraOrganizativaTests(TestCase):
    def setUp(self):
        self.d = datos_base()
        self.api = cliente()
        self.dg = UnidadOrganizativa.objects.get(tipo=TipoUnidad.DIRECCION_GENERAL)
        self.infra = UnidadOrganizativa.objects.get(nombre="Dirección de Infraestructura")

    def crear(self, **datos):
        return self.api.post("/api/organizacion/unidades/", datos, format="json")

    def test_inicializar_no_toca_una_estructura_existente(self):
        from . import seeds

        self.infra.nombre = "DIRECCIÓN DE INFRAESTRUCTURA"
        self.infra.save()
        antes = list(UnidadOrganizativa.objects.values_list("nombre", flat=True))
        seeds.cargar()  # inicializar corre en cada arranque del contenedor
        self.assertEqual(list(UnidadOrganizativa.objects.values_list("nombre", flat=True)), antes)

    def test_jerarquia_valida(self):
        r = self.crear(nombre="Mesa de ayuda", tipo="AREA", padre=self.infra.id)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["ruta"], "Dirección de Infraestructura › Mesa de ayuda")

    def test_rechaza_jerarquia_invertida_y_sin_padre(self):
        area = self.d["area"]
        self.assertIn("padre", self.crear(nombre="X", tipo="DIRECCION", padre=area.id).data)
        self.assertIn("padre", self.crear(nombre="Y", tipo="AREA").data)
        self.assertIn("padre", self.crear(nombre="Z", tipo="DIRECCION_GENERAL", padre=self.dg.id).data)

    def test_rechaza_ciclos_y_nombres_repetidos(self):
        r = self.api.patch(f"/api/organizacion/unidades/{self.infra.id}/", {"padre": self.d["area"].id}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("nombre", self.crear(nombre="soporte", tipo="AREA", padre=self.infra.id).data)

    def test_arbol_cuenta_empleados_directos_y_totales(self):
        crear_empleado(self.dg, self.d["planta"], 1)
        crear_empleado(self.d["area"], self.d["planta"], 2)
        arbol = self.api.get("/api/organizacion/unidades/arbol/").data
        raiz = arbol[0]
        self.assertEqual((raiz["empleados"], raiz["empleados_total"]), (1, 2))

    def test_descendientes_y_agrupador(self):
        arbol = Arbol()
        self.assertEqual(arbol.descendientes([self.infra.id]), {self.infra.id, self.d["area"].id})
        self.assertEqual(arbol.agrupador(self.d["area"].id), self.infra)
        self.assertEqual(arbol.agrupador(self.dg.id), self.dg)

    def test_no_se_elimina_unidad_con_empleados(self):
        crear_empleado(self.d["area"], self.d["planta"])
        r = self.api.delete(f"/api/organizacion/unidades/{self.d['area'].id}/")
        self.assertEqual(r.status_code, 409)


class SeedsOrganizacionTests(TestCase):
    def test_instalacion_nueva_solo_crea_la_direccion_general(self):
        from . import seeds

        seeds.cargar()
        seeds.cargar()  # idempotente
        self.assertEqual(list(UnidadOrganizativa.objects.values_list("tipo", flat=True)), [TipoUnidad.DIRECCION_GENERAL])


class ActoAdministrativoTests(TestCase):
    def setUp(self):
        import tempfile

        from django.test import override_settings

        self.media = tempfile.TemporaryDirectory()
        self.override = override_settings(MEDIA_ROOT=self.media.name)
        self.override.enable()
        self.d = datos_base()
        self.api = cliente()
        self.infra = UnidadOrganizativa.objects.get(nombre="Dirección de Infraestructura")

    def tearDown(self):
        self.override.disable()
        self.media.cleanup()

    def test_unidad_creada_exige_acto_administrativo(self):
        datos = {"nombre": "Departamento de Soporte Técnico", "tipo": "AREA", "padre": self.infra.id, "creada": True}
        r = self.api.post("/api/organizacion/unidades/", datos, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("acto_administrativo", r.data)
        r = self.api.post("/api/organizacion/unidades/", {**datos, "acto_administrativo": "Resolución 109-2026"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual((r.data["creada"], r.data["acto_administrativo"]), (True, "Resolución 109-2026"))
        # Nombre corto automático (sin "Departamento de") o el configurado
        self.assertEqual(r.data["nombre_tarjeta"], "Soporte Técnico")
        r = self.api.patch(f"/api/organizacion/unidades/{r.data['id']}/", {"nombre_corto": "Soporte"}, format="json")
        self.assertEqual(r.data["nombre_tarjeta"], "Soporte")

    def test_adjunto_del_acto(self):
        import os

        from django.core.files.uploadedfile import SimpleUploadedFile

        from .models import DocumentoUnidad

        unidad = self.d["area"]
        archivo = SimpleUploadedFile("resolucion.pdf", b"%PDF-1.4 acto", content_type="application/pdf")
        r = self.api.post("/api/organizacion/documentos-unidad/", {"unidad": unidad.id, "archivo": archivo}, format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(self.api.get(f"/api/organizacion/unidades/{unidad.id}/").data["documentos_count"], 1)
        descarga = self.api.get(f"/api/organizacion/documentos-unidad/{r.data['id']}/descargar/")
        self.assertEqual(b"".join(descarga.streaming_content), b"%PDF-1.4 acto")
        ruta = DocumentoUnidad.objects.get().archivo.path
        self.assertEqual(self.api.delete(f"/api/organizacion/unidades/{unidad.id}/").status_code, 204)
        self.assertFalse(os.path.exists(ruta))
