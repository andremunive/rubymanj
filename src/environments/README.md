# Variables de entorno — Supabase

## Desarrollo local

1. Copia `.env.example` como `.env` en la raíz del proyecto.
2. Pega los valores reales:

```
SUPABASE_URL=https://<tu-proyecto>.supabase.co
SUPABASE_KEY=<anon-public-key>
```

La **anon key** se obtiene en el dashboard de Supabase:
**Settings → API → Project API keys → "anon public"**

3. Al ejecutar `npm start`, el script `scripts/set-env.js` genera automáticamente
   `environment.ts` y `environment.development.ts` con los valores correctos.

## Producción / CI

Establece las variables de entorno `SUPABASE_URL` y `SUPABASE_KEY` en la plataforma
de CI/CD o en el panel de hosting. El script las leerá de `process.env`.

## Seguridad

- La **anon key** es pública por diseño de Supabase (lleva las políticas RLS aplicadas).
- Nunca subas la **service_role key** al frontend — esa tiene permisos de administrador.
