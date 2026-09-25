"""
Consultas sobre el árbol de unidades organizativas.

La estructura es chica (decenas de nodos), así que se carga completa en
memoria y se recorre en Python: más simple y rápido que consultas recursivas.
"""
from collections import defaultdict

from .models import TipoUnidad, UnidadOrganizativa

SEPARADOR = " › "


class Arbol:
    """Estructura organizativa cargada en memoria con utilidades de recorrido."""

    def __init__(self, unidades=None):
        unidades = list(unidades if unidades is not None else UnidadOrganizativa.objects.all())
        self.nodos: dict[int, UnidadOrganizativa] = {u.id: u for u in unidades}
        self.hijos: dict[int | None, list[UnidadOrganizativa]] = defaultdict(list)
        for u in sorted(unidades, key=lambda u: (u.orden, u.nombre)):
            self.hijos[u.padre_id].append(u)
        self._raices = self.hijos[None]

    def ancestros(self, unidad_id: int) -> list[UnidadOrganizativa]:
        """Desde la raíz hasta la unidad (inclusive)."""
        camino = []
        actual = self.nodos.get(unidad_id)
        while actual is not None:
            camino.append(actual)
            actual = self.nodos.get(actual.padre_id)
        return list(reversed(camino))

    def ruta(self, unidad_id: int) -> str:
        """
        Nombre completo legible. Si hay una sola raíz (la Dirección General) se
        omite para no repetirla en cada fila, salvo que la unidad sea la raíz.
        """
        camino = self.ancestros(unidad_id)
        if len(self._raices) == 1 and len(camino) > 1:
            camino = camino[1:]
        return SEPARADOR.join(u.nombre for u in camino)

    def descendientes(self, ids) -> set[int]:
        """Las unidades indicadas y todas las que dependen de ellas."""
        resultado: set[int] = set()
        pendientes = [int(i) for i in ids]
        while pendientes:
            actual = pendientes.pop()
            if actual in resultado:
                continue
            resultado.add(actual)
            pendientes.extend(h.id for h in self.hijos.get(actual, []))
        return resultado

    def agrupador(self, unidad_id: int, tipo: str = TipoUnidad.DIRECCION) -> UnidadOrganizativa | None:
        """
        Unidad de nivel `tipo` a la que pertenece (ella misma o un ancestro).
        Si depende directamente de un nivel superior, devuelve ese nivel
        (p. ej. personal de la Dirección General al agrupar por Dirección).
        """
        camino = self.ancestros(unidad_id)
        nivel = TipoUnidad.nivel(tipo)
        candidatos = [u for u in camino if TipoUnidad.nivel(u.tipo) <= nivel]
        return candidatos[-1] if candidatos else None

    def agrupadores(self, tipo: str = TipoUnidad.DIRECCION) -> list[UnidadOrganizativa]:
        """
        Unidades por las que se agrupa el personal (orden del árbol): cada raíz
        y sus dependientes hasta el nivel `tipo`. Con los niveles actuales:
        Dirección General, Dirección de Desarrollo, Dirección de Infraestructura.
        """
        nivel = TipoUnidad.nivel(tipo)
        resultado = []

        def recorrer(unidad):
            if not unidad.activo or TipoUnidad.nivel(unidad.tipo) > nivel:
                return
            resultado.append(unidad)
            for hija in self.hijos.get(unidad.id, []):
                recorrer(hija)

        for raiz in self._raices:
            recorrer(raiz)
        return resultado

    def como_lista_anidada(self, contar: dict[int, int] | None = None, solo_activas=False) -> list[dict]:
        """Árbol serializable (para TreeSelect / tabla jerárquica)."""
        contar = contar or {}

        def armar(unidad) -> dict:
            hijos = [armar(h) for h in self.hijos.get(unidad.id, []) if h.activo or not solo_activas]
            directos = contar.get(unidad.id, 0)
            return {
                "id": unidad.id,
                "nombre": unidad.nombre,
                "descripcion": unidad.descripcion,
                "tipo": unidad.tipo,
                "tipo_display": unidad.get_tipo_display(),
                "padre": unidad.padre_id,
                "orden": unidad.orden,
                "activo": unidad.activo,
                "ruta": self.ruta(unidad.id),
                "empleados": directos,
                "empleados_total": directos + sum(h["empleados_total"] for h in hijos),
                "children": hijos,
            }

        return [armar(r) for r in self._raices if r.activo or not solo_activas]


def ids_param(valor: str | None) -> list[str]:
    return [v for v in (valor or "").split(",") if v]


def unidades_con_descendientes(valor: str | None, arbol: Arbol | None = None) -> set[int] | None:
    """Convierte el parámetro `unidad=1,5` en el conjunto de unidades a filtrar (None = sin filtro)."""
    ids = ids_param(valor)
    if not ids:
        return None
    return (arbol or Arbol()).descendientes(ids)
