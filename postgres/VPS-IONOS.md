# Instalación en el VPS IONOS

Este procedimiento corresponde al servidor actual: Debian 13, PostgreSQL 18,
Nginx, Certbot, usuario de aplicaciones `novasoft` y proyectos bajo
`/srv/novasoft`.

## 1. Identificar el puerto de PostgreSQL 18

~~~bash
PG18PORT=$(pg_lsclusters -h | awk '$1=="18" && $2=="main" {print $3}')
echo "$PG18PORT"
sudo -u postgres psql -p "$PG18PORT" -c "select version();"
~~~

## 2. Crear usuario y base exclusivos

~~~bash
sudo -u postgres createuser -p "$PG18PORT" --pwprompt pliegoluz_app
sudo -u postgres createdb -p "$PG18PORT" -O pliegoluz_app -T template0 pliegoluz_db
~~~

La contraseña debe ser larga y distinta de las demás aplicaciones. No uses el
rol postgres en DATABASE_URL y no publiques el puerto en el firewall.

## 3. Configurar Pliegoluz

En `/srv/novasoft/Pliegoluz/.env` agrega:

~~~env
DATABASE_URL=postgresql://pliegoluz_app:CONTRASEÑA_URL_ENCODED@127.0.0.1:PUERTO/pliegoluz_db
POSTGRES_SSL=disable
POSTGRES_POOL_MAX=10
~~~

Conserva también las variables de Firebase y protege el archivo:

~~~bash
chown novasoft:novasoft /srv/novasoft/Pliegoluz/.env
chmod 600 /srv/novasoft/Pliegoluz/.env
~~~

Si la contraseña contiene caracteres como `@`, `:`, `/`, `#` o `%`,
deben codificarse para una URL.

## 4. Instalar y crear el esquema

~~~bash
cd /srv/novasoft/Pliegoluz
runuser -u novasoft -- npm ci
runuser -u novasoft -- npm run db:schema
runuser -u novasoft -- npm run db:check
runuser -u novasoft -- npm run build
~~~

## 5. Restaurar el administrador

1. Inicia sesión una vez en Pliegoluz usando la cuenta de Firebase.
2. Ejecuta en el VPS:

~~~bash
cd /srv/novasoft/Pliegoluz
runuser -u novasoft -- npm run db:promote-admin -- administrador@ejemplo.com
runuser -u novasoft -- npm run db:check
~~~

3. Cierra sesión y vuelve a entrar.

## 6. Respaldo

El respaldo debe ejecutarse con un archivo de entorno protegido o una
credencial no expuesta en el historial:

~~~bash
pg_dump --format=custom --no-owner --file=/ruta-segura/pliegoluz.dump "$DATABASE_URL"
~~~

Conserva al menos una copia cifrada fuera del VPS.
