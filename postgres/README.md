# PostgreSQL de Pliegoluz

Este directorio reemplaza la infraestructura de Supabase por PostgreSQL directo.

## Inicialización

Configura `DATABASE_URL` y ejecuta:

```bash
npm run db:schema
```

El esquema es idempotente y puede volver a aplicarse durante un despliegue.

## Recuperar el administrador

Después de iniciar sesión una vez con la cuenta de Firebase, ejecuta:

```bash
npm run db:promote-admin -- admin@ejemplo.com
```

El comando falla si el correo todavía no creó su perfil o si hay más de una coincidencia.

## Respaldo recomendado

```bash
pg_dump --format=custom --no-owner --file=pliegoluz.dump "$DATABASE_URL"
```

Guarda una copia cifrada fuera del VPS y prueba regularmente su restauración.
