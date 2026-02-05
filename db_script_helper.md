Sudah saya rapikan script helper di package.json (tanpa duplikasi). Kamu bisa pakai:

Local:
npm run db:local:reset
npm run db:local:push

Prod/Tunnel (pakai project yang sudah di‑link):
npm run db:prod:link → pilih project dulu
npm run db:prod:push
npm run db:prod:reset
npm run db:tunnel:push
## Supabase link helpers (select project)

Set env var once per shell:

```
export SUPABASE_TUNNEL_REF=okwomythcxywaaqoqcsl
export SUPABASE_PROD_REF=your-prod-ref
```

Then link to target project:

```
npm run db:tunnel:link
npm run db:prod:link
```

## Local
```
npm run db:local:push
npm run db:local:reset
```

## Tunnel
```
npm run db:tunnel:link
npm run db:tunnel:push
npm run db:tunnel:reset
```

## Production
```
npm run db:prod:link
npm run db:prod:push
npm run db:prod:reset
```
