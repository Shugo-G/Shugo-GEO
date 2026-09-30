from apps.core.fechas import parse_fecha_param
from apps.novedades.models import TipoNovedad
from apps.organizacion.models import ModalidadContratacion, UnidadOrganizativa
from apps.personal.models import Empleado, SituacionRevista


def ids(valor) -> list[str]:
    return [v for v in (valor or "").split(",") if v]


def fmt_fecha(fecha) -> str:
    return fecha.strftime("%d/%m/%Y") if fecha else "—"


def describir_filtros(params, nombres: list[str]) -> str:
    """Texto legible con los filtros aplicados, para encabezados de Excel/PDF."""
    partes = []

    def nombres_de(modelo, clave, etiqueta, campo="nombre"):
        if valores := ids(params.get(clave)):
            textos = [str(getattr(o, campo)) for o in modelo.objects.filter(id__in=valores)]
            partes.append(f"{etiqueta}: {', '.join(textos)}")

    if "fecha" in nombres:
        fecha = parse_fecha_param(params.get("fecha"), "fecha")
        if fecha:
            partes.append(f"Fecha: {fmt_fecha(fecha)}")
    if "periodo" in nombres:
        desde = parse_fecha_param(params.get("desde"), "desde")
        hasta = parse_fecha_param(params.get("hasta"), "hasta")
        if desde or hasta:
            partes.append(f"Período: {fmt_fecha(desde)} al {fmt_fecha(hasta)}")
    if "tipo_insumo" in nombres:
        from apps.patrimonio.models import TipoInsumo

        nombres_de(TipoInsumo, "tipo_insumo", "Insumo")
    if "situacion_cargo" in nombres:
        partes.append(
            {"historial": "Situación: dados de baja / transferidos", "todos": "Situación: todos"}.get(
                params.get("situacion_cargo"), "Situación: a cargo"
            )
        )
    if "unidad" in nombres:
        nombres_de(UnidadOrganizativa, "unidad", "Unidad")
    if "modalidad" in nombres:
        nombres_de(ModalidadContratacion, "modalidad", "Modalidad")
    if "empleado" in nombres:
        nombres_de(Empleado, "empleado", "Empleado", "nombre_completo")
    if "tipo_novedad" in nombres:
        nombres_de(TipoNovedad, "tipo_novedad", "Artículo")
    if "tipo_saldo" in nombres:
        nombres_de(TipoNovedad, "tipo_saldo", "Artículo")
    if "situacion_revista" in nombres and (valores := ids(params.get("situacion_revista"))):
        etiquetas = dict(SituacionRevista.choices)
        partes.append(f"Situación: {', '.join(etiquetas.get(v, v) for v in valores)}")
    return " | ".join(partes) or "Sin filtros"
