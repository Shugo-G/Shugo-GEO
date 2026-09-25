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
