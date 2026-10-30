# Pliegoluz — biblioteca digital

Plataforma de lectura construida con Next.js, TypeScript, Tailwind CSS,
Firebase Authentication y PostgreSQL.

## Desarrollo local

~~~bash
npm install
copy .env.example .env.local
npm run db:schema
npm run dev
~~~

La aplicación queda disponible en http://localhost:3000.

## Rutas principales

- / — portada.
- /biblioteca — catálogo público.
- /libros/[slug] — ficha e índice de una obra.
- /leer/[slug]/[chapter] — lector.
- /login y /registro — acceso mediante Firebase.
- /perfil — biblioteca y progreso del lector.
- /dashboard — gestión editorial.

## PostgreSQL

La aplicación se conecta directamente mediante DATABASE_URL. La cuenta
configurada debe ser propietaria exclusivamente de la base de Pliegoluz; no
uses el superusuario postgres.

Para una base vacía:

~~~bash
npm run db:schema
~~~

El esquema consolidado está en [postgres/schema.sql](postgres/schema.sql). Las
carátulas se guardan como bytea en la misma base para que el respaldo sea
autocontenido.

Las variables relevantes son:

~~~env
DATABASE_URL=postgresql://pliegoluz_app:contraseña@127.0.0.1:5432/pliegoluz_db
POSTGRES_SSL=disable
POSTGRES_POOL_MAX=10
~~~

Usa POSTGRES_SSL=require solamente cuando el servidor PostgreSQL remoto
presente un certificado confiable. En el mismo VPS, conecta por 127.0.0.1 y
no expongas el puerto de PostgreSQL a Internet.

## Firebase Authentication

Firebase conserva las credenciales. PostgreSQL conserva perfiles, roles y
datos de la aplicación. La cookie de sesión es HttpOnly y Firebase Admin la
verifica en el servidor.

Configura la aplicación web y la cuenta de servicio usando las variables
NEXT_PUBLIC_FIREBASE_* y FIREBASE_ADMIN_* de .env.example. Nunca publiques
DATABASE_URL ni las variables FIREBASE_ADMIN_*.

Los usuarios nuevos se crean con rol reader. Para restaurar la cuenta
administradora:

1. Inicia sesión una vez con el correo correcto para crear el perfil.
2. Ejecuta:

~~~bash
npm run db:promote-admin -- administrador@ejemplo.com
~~~

3. Cierra sesión y vuelve a entrar.

Los roles author y admin pueden crear y editar libros. Un autor solo puede
administrar sus propias obras.

## Importación de libros

Desde el panel editorial puede importarse un PDF completo de hasta 10 MB y 50
capítulos. El texto debe ser seleccionable y cada capítulo debe comenzar con
“Capítulo 1” o “Capítulo I”.

El importador histórico de Casa Reykov continúa disponible:

~~~bash
npm run import:casa-reykov
~~~

Este comando genera SQL; para una recuperación nueva también puede importarse
el PDF desde el panel.

## Respaldo

Ejemplo de respaldo lógico:

~~~bash
pg_dump --format=custom --no-owner --file=pliegoluz.dump "$DATABASE_URL"
~~~

Conserva copias cifradas fuera del VPS y prueba periódicamente una restauración
con pg_restore.

Los archivos de supabase/ se conservan únicamente como historial de la
implementación anterior y no deben aplicarse a la base PostgreSQL nueva.
