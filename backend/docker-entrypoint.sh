#!/bin/sh
set -e

# Aplica migraciones, configura roles/catálogos iniciales y junta estáticos del admin.
python manage.py migrate --noinput
python manage.py inicializar
python manage.py collectstatic --noinput

exec "$@"
