"""
Archivos adjuntos (documentación respaldatoria de licencias, planillas de cargo...).

Se guardan con nombre aleatorio en media/<carpeta>/AAAA/MM/ y nunca se sirven
públicamente: se descargan por la API con autenticación y permisos.
"""
import os
import uuid

from django.conf import settings
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import serializers

EXTENSIONES_PERMITIDAS = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx", ".odt"]


def ruta_adjunto(carpeta: str, filename: str, fecha=None) -> str:
    extension = os.path.splitext(filename)[1].lower()
    return f"{carpeta}/{(fecha or timezone.localdate()):%Y/%m}/{uuid.uuid4().hex}{extension}"


def validar_adjunto(archivo):
    """Formato permitido y tamaño máximo (DOCUMENTO_MAX_MB)."""
    extension = os.path.splitext(archivo.name)[1].lower()
    if extension not in EXTENSIONES_PERMITIDAS:
        raise serializers.ValidationError(f"Formato no permitido. Formatos válidos: {', '.join(EXTENSIONES_PERMITIDAS)}")
    if archivo.size > settings.DOCUMENTO_MAX_MB * 1024 * 1024:
        raise serializers.ValidationError(f"El archivo supera los {settings.DOCUMENTO_MAX_MB} MB.")
    return archivo


def tamanio_adjunto(campo) -> int | None:
    try:
        return campo.size
    except (FileNotFoundError, ValueError):
        return None


def descargar_adjunto(campo, nombre: str) -> FileResponse:
    try:
        archivo = campo.open("rb")
    except FileNotFoundError:
        raise Http404("El archivo no existe en el servidor.")
    return FileResponse(archivo, as_attachment=True, filename=nombre)
