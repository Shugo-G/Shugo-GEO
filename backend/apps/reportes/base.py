"""
Infraestructura de reportes.

Para agregar un reporte nuevo:
    1. Crear una subclase de `Reporte` en definiciones.py.
    2. Decorarla con @registrar.
    3. Definir `clave`, `titulo`, `filtros`, `columnas` y el método `filas()`.
El frontend lo lista automáticamente y arma el formulario de filtros; la
exportación a Excel/PDF es genérica.
"""
from dataclasses import dataclass, field

# Filtros que el frontend sabe renderizar. Agregar acá si se crea uno nuevo.
FILTROS_DISPONIBLES = {
    "fecha": "Fecha",
    "periodo": "Período",
    "unidad": "Unidad organizativa",
    "modalidad": "Modalidad",
    "empleado": "Empleado",
    "tipo_novedad": "Tipo de novedad",
    "categoria": "Categoría de estado",
    "situacion_revista": "Situación de revista",
    "tipo_saldo": "Tipo de licencia con saldo",
    "tipo_insumo": "Insumo",
    "situacion_cargo": "Situación del cargo",
}


@dataclass
class Columna:
    clave: str
    titulo: str
    ancho: int = 15  # ancho relativo (caracteres aprox. en Excel)
    tipo: str = "texto"  # texto | fecha | numero


@dataclass
class Filtro:
    nombre: str
    requerido: bool = False
    multiple: bool = True

    def as_dict(self):
        return {
            "nombre": self.nombre,
            "etiqueta": FILTROS_DISPONIBLES[self.nombre],
            "requerido": self.requerido,
            "multiple": self.multiple,
        }


@dataclass
class ResultadoReporte:
    titulo: str
    columnas: list[Columna]
    filas: list[dict]
    subtitulo: str = ""
    orientacion_horizontal: bool = True
    extra: dict = field(default_factory=dict)


class Reporte:
    clave: str = ""
    titulo: str = ""
    descripcion: str = ""
    grupo: str = "General"
    filtros: list[Filtro] = []
    permisos: tuple[str, ...] = ("personal.view_empleado",)
    horizontal: bool = True

    def columnas(self, params) -> list[Columna]:
        raise NotImplementedError

    def filas(self, params) -> list[dict]:
        raise NotImplementedError

    def validar(self, params) -> dict[str, str]:
        errores = {}
        for filtro in self.filtros:
            if not filtro.requerido:
                continue
            claves = ["desde", "hasta"] if filtro.nombre == "periodo" else [filtro.nombre]
            if not all(params.get(c) for c in claves):
                errores[filtro.nombre] = f"El filtro '{FILTROS_DISPONIBLES[filtro.nombre]}' es obligatorio."
        return errores

    def generar(self, params) -> ResultadoReporte:
        from .utils import describir_filtros

        return ResultadoReporte(
            titulo=self.titulo,
            subtitulo=describir_filtros(params, [f.nombre for f in self.filtros]),
            columnas=self.columnas(params),
            filas=self.filas(params),
            orientacion_horizontal=self.horizontal,
        )

    @classmethod
    def metadata(cls) -> dict:
        return {
            "clave": cls.clave,
            "titulo": cls.titulo,
            "descripcion": cls.descripcion,
            "grupo": cls.grupo,
            "filtros": [f.as_dict() for f in cls.filtros],
        }


class RegistroReportes:
    def __init__(self):
        self._reportes: dict[str, type[Reporte]] = {}

    def registrar(self, clase: type[Reporte]) -> type[Reporte]:
        if clase.clave in self._reportes:
            raise ValueError(f"Ya existe un reporte con clave '{clase.clave}'")
        self._reportes[clase.clave] = clase
        return clase

    def obtener(self, clave: str) -> type[Reporte] | None:
        return self._reportes.get(clave)

    def disponibles_para(self, user) -> list[type[Reporte]]:
        return [r for r in self._reportes.values() if user.has_perms(r.permisos)]


registro = RegistroReportes()
registrar = registro.registrar
