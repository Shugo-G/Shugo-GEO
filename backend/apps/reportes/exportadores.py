"""Exportación genérica de un ResultadoReporte a Excel y PDF."""
from datetime import date, datetime
from io import BytesIO

from django.conf import settings
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .base import ResultadoReporte

COLOR_PRIMARIO = "1F4E79"  # placeholder hasta definir identidad institucional


def _texto_celda(valor, tipo: str) -> str:
    if valor is None or valor == "":
        return "—" if tipo == "fecha" else ""
    if isinstance(valor, date):
        return valor.strftime("%d/%m/%Y")
    return str(valor)


def _encabezado_institucional() -> tuple[str, str]:
    cfg = settings.SHUGO
    return f"{cfg['MUNICIPIO']} — {cfg['ORGANISMO']}", f"{cfg['NOMBRE_SISTEMA']} · {cfg['DESCRIPCION_SISTEMA']}"


def exportar_excel(resultado: ResultadoReporte, usuario: str) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = resultado.titulo[:31]
    institucion, sistema = _encabezado_institucional()
    n_cols = len(resultado.columnas)

    ws.append([institucion])
    ws.append([resultado.titulo])
    ws.append([resultado.subtitulo])
    ws.append([f"Generado el {timezone.localtime():%d/%m/%Y %H:%M} por {usuario} — {sistema}"])
    ws.append([])
    ws["A1"].font = Font(bold=True, color=COLOR_PRIMARIO)
    ws["A2"].font = Font(bold=True, size=14)
    ws["A3"].font = Font(italic=True, color="595959")
    ws["A4"].font = Font(size=9, color="7F7F7F")

    fila_encabezado = 6
    ws.append([c.titulo for c in resultado.columnas])
    borde = Border(bottom=Side(style="thin", color="BFBFBF"))
    for idx in range(1, n_cols + 1):
        celda = ws.cell(row=fila_encabezado, column=idx)
        celda.font = Font(bold=True, color="FFFFFF")
        celda.fill = PatternFill("solid", fgColor=COLOR_PRIMARIO)
        celda.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    for fila in resultado.filas:
        valores = []
        for col in resultado.columnas:
            valor = fila.get(col.clave)
            if isinstance(valor, datetime):
                valor = timezone.localtime(valor).replace(tzinfo=None)
            valores.append(valor)
        ws.append(valores)
        for idx, col in enumerate(resultado.columnas, start=1):
            celda = ws.cell(row=ws.max_row, column=idx)
            celda.border = borde
            if col.tipo == "fecha":
                celda.number_format = "DD/MM/YYYY"
                celda.alignment = Alignment(horizontal="center")

    for idx, col in enumerate(resultado.columnas, start=1):
        ws.column_dimensions[get_column_letter(idx)].width = col.ancho + 2
    ws.freeze_panes = ws.cell(row=fila_encabezado + 1, column=1)
    if resultado.filas:
        ws.auto_filter.ref = f"A{fila_encabezado}:{get_column_letter(n_cols)}{ws.max_row}"

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def exportar_pdf(resultado: ResultadoReporte, usuario: str) -> bytes:
    buffer = BytesIO()
    tamanio = landscape(A4) if resultado.orientacion_horizontal else A4
    doc = SimpleDocTemplate(
        buffer,
        pagesize=tamanio,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title=resultado.titulo,
    )
    estilos = getSampleStyleSheet()
    estilo_celda = ParagraphStyle("celda", parent=estilos["Normal"], fontSize=7.5, leading=9)
    estilo_header = ParagraphStyle("header", parent=estilo_celda, textColor=colors.white, fontName="Helvetica-Bold")
    institucion, sistema = _encabezado_institucional()
    generado = f"Generado el {timezone.localtime():%d/%m/%Y %H:%M} por {usuario}"

    elementos = [
        Paragraph(institucion, ParagraphStyle("inst", parent=estilos["Normal"], textColor=colors.HexColor(f"#{COLOR_PRIMARIO}"), fontName="Helvetica-Bold")),
        Spacer(1, 2 * mm),
        Paragraph(resultado.titulo, estilos["Title"]),
        Paragraph(resultado.subtitulo, ParagraphStyle("sub", parent=estilos["Normal"], fontSize=9, textColor=colors.grey)),
        Spacer(1, 4 * mm),
    ]

    ancho_util = tamanio[0] - doc.leftMargin - doc.rightMargin
    total_relativo = sum(c.ancho for c in resultado.columnas) or 1
    anchos = [ancho_util * c.ancho / total_relativo for c in resultado.columnas]

    datos = [[Paragraph(c.titulo, estilo_header) for c in resultado.columnas]]
    for fila in resultado.filas:
        datos.append([Paragraph(_texto_celda(fila.get(c.clave), c.tipo), estilo_celda) for c in resultado.columnas])
    if len(datos) == 1:
        datos.append([Paragraph("Sin resultados para los filtros seleccionados.", estilo_celda)] + [""] * (len(anchos) - 1))

    tabla = Table(datos, colWidths=anchos, repeatRows=1)
    tabla.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(f"#{COLOR_PRIMARIO}")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F2F5F9")]),
                ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#BFBFBF")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    elementos.append(tabla)
    elementos.append(Spacer(1, 3 * mm))
    elementos.append(Paragraph(f"Total de registros: {len(resultado.filas)}", estilo_celda))

    def pie(canvas, documento):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.grey)
        canvas.drawString(doc.leftMargin, 8 * mm, f"{sistema} — {generado}")
        canvas.drawRightString(tamanio[0] - doc.rightMargin, 8 * mm, f"Página {documento.page}")
        canvas.restoreState()

    doc.build(elementos, onFirstPage=pie, onLaterPages=pie)
    return buffer.getvalue()
