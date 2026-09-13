# Pliegoluz — biblioteca digital

MVP de una plataforma de lectura para **Casa Reykov**, construido con Next.js, TypeScript, Tailwind CSS, Firebase Authentication y Supabase.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Rutas disponibles

- `/` — portada y biblioteca.
- `/libros/casa-reykov` — ficha e índice de los 41 capítulos.
- `/leer/casa-reykov/1` — lector con preferencias y marcador local.
- `/login` — inicio de sesión con Google o correo.
- `/registro` — creación de cuentas de lectores.
- `/dashboard` — gestión de libros, metadatos y capítulos.

## Supabase

La interfaz funciona sin credenciales. Para conectar Supabase:

1. Copia `.env.example` como `.env.local`.
2. Añade la URL y la clave pública del proyecto.
3. Ejecuta `supabase/schema.sql` desde el SQL Editor de Supabase.
4. Ejecuta `supabase/seed.sql` para crear Casa Reykov y sus 41 capítulos.
5. Ejecuta `supabase/import-casa-reykov.sql` para cargar el contenido canónico.

No publiques `SUPABASE_SERVICE_ROLE_KEY` ni las variables `FIREBASE_ADMIN_*`. Solo las claves expresamente prefijadas con `NEXT_PUBLIC_` pueden llegar al navegador.

## Firebase Authentication

Firebase conserva las credenciales y Supabase conserva los perfiles y roles. Cada fila de `firebase_profiles` tiene un UUID interno y un `firebase_uid` único que enlaza ambas plataformas.

1. Crea o abre un proyecto en [Firebase Console](https://console.firebase.google.com/).
2. Registra una aplicación web y copia `apiKey`, `authDomain`, `projectId` y `appId` en las variables `NEXT_PUBLIC_FIREBASE_*` de `.env.local`.
3. En **Authentication > Sign-in method**, habilita **Correo/contraseña** y **Google**.
4. En **Project settings > Service accounts**, genera una clave privada. Copia `project_id`, `client_email` y `private_key` en las variables `FIREBASE_ADMIN_*`.
5. En Supabase, copia la clave secreta de servidor en `SUPABASE_SERVICE_ROLE_KEY`. Nunca debe usar el prefijo `NEXT_PUBLIC_`.
6. Para una base existente, ejecuta `supabase/firebase-auth.sql` en el SQL Editor.

Las sesiones se intercambian por una cookie `HttpOnly` de Firebase. Las operaciones editoriales utilizan la clave secreta de Supabase únicamente en el servidor y vuelven a comprobar el rol antes de cada mutación.

## Activar el panel editorial

En un proyecto de Supabase que ya tiene el esquema y el libro importado:

1. Completa la configuración de Firebase descrita arriba.
2. Ejecuta `supabase/firebase-auth.sql` en el SQL Editor. La migración puede ejecutarse más de una vez.
3. Entra una vez desde `/login` con Google o crea tu cuenta desde `/registro`. Esto crea el perfil vinculado en Supabase.
4. En el SQL Editor, reemplaza el correo y ejecuta:

```sql
update public.firebase_profiles
set role = 'admin', updated_at = now()
where lower(email) = lower('tu-correo@ejemplo.com');
```

5. Cierra la sesión y vuelve a entrar en [http://localhost:3000/login](http://localhost:3000/login).

Los usuarios nuevos reciben el rol `reader`. Los roles `author` y `admin` pueden crear y editar libros y capítulos. Los cambios con estado `published` aparecen en la biblioteca pública.

En instalaciones existentes, ejecuta también `supabase/roles-community.sql`, `supabase/reading-progress-position.sql` y `supabase/published-content-constraint.sql` para aplicar las restricciones y funciones añadidas después del esquema inicial.

## Importar nuevamente el PDF

El importador busca por defecto el PDF canónico en la carpeta `Downloads` del usuario y genera el SQL sin modificar el archivo original:

```bash
npm run import:casa-reykov
```

También puedes indicar otras rutas:

```bash
npm run import:casa-reykov -- "C:\ruta\Casa_Reykov.pdf" "supabase\import-casa-reykov.sql"
```

El script exige encontrar exactamente 41 capítulos, elimina encabezados y números de página, calcula el tiempo estimado de lectura y genera una importación idempotente.
