from django.test import TestCase

from apps.core.testing import ROL_CONSULTA, cliente, datos_base

from . import seeds
from .models import EstadoLinea, Proveedor, TipoSim


class ServiciosTests(TestCase):
    def setUp(self):
        datos_base()
        seeds.cargar()
        self.api = cliente()
        self.claro = Proveedor.objects.get(nombre="Claro")
        self.activa = EstadoLinea.objects.get(nombre="Activa")
        self.esim = TipoSim.objects.get(nombre="SIM virtual")

    def crear_linea(self, api=None, **extra):
        datos = {
            "numero": "2901-555000",
            "numero_sim": "8954310000000000001",
            "tipo_sim": self.esim.id,
            "proveedor": self.claro.id,
            "estado": self.activa.id,
            "responsable": "Juan Pérez",
            "area": "Mesa de entradas",
            "secretaria": "Secretaría de Hacienda",
        }
        datos.update(extra)
        return (api or self.api).post("/api/servicios/lineas/", datos, format="json")

    def test_alta_de_linea_con_catalogos(self):
        r = self.crear_linea()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(
            (r.data["proveedor_nombre"], r.data["estado_nombre"], r.data["tipo_sim_nombre"]),
            ("Claro", "Activa", "SIM virtual"),
        )
        self.assertEqual(self.api.get("/api/servicios/lineas/", {"search": "Hacienda"}).data["count"], 1)

    def test_numero_de_linea_unico_y_obligatorios(self):
        self.crear_linea()
        r = self.crear_linea(numero=" 2901-555000 ")
        self.assertEqual(r.status_code, 400)
        self.assertIn("numero", r.data)
        r = self.api.post("/api/servicios/lineas/", {"numero": "123"}, format="json")
        self.assertEqual(set(r.data), {"proveedor", "estado"})

    def test_internet(self):
        r = self.api.post(
            "/api/servicios/internet/",
            {"sitio": "Edificio central", "direccion": "San Martín 660", "proveedor": self.claro.id, "numero_fsan": "ALCL1234",
             "velocidad": "300 Mbps", "ip_publica": "200.1.2.3"},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["proveedor_nombre"], "Claro")

    def test_proveedor_en_uso_no_se_borra(self):
        self.crear_linea()
        self.assertEqual(self.api.delete(f"/api/servicios/proveedores/{self.claro.id}/").status_code, 409)

    def test_consulta_solo_lee(self):
        consulta = cliente(ROL_CONSULTA)
        self.assertEqual(consulta.get("/api/servicios/lineas/").status_code, 200)
        self.assertEqual(consulta.get("/api/servicios/proveedores/").status_code, 200)
        self.assertEqual(self.crear_linea(api=consulta).status_code, 403)

    def test_seeds_no_recrean_lo_borrado(self):
        Proveedor.objects.filter(nombre="Supercanal").delete()
        seeds.cargar()
        self.assertFalse(Proveedor.objects.filter(nombre="Supercanal").exists())
        self.assertEqual(list(EstadoLinea.objects.values_list("nombre", flat=True)), ["Activa", "Suspendida", "Dada de baja"])
