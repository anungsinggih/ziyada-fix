Sudah saya rapikan script helper di package.json (tanpa duplikasi). Kamu bisa pakai:

Local:
npm run db:local:reset
npm run db:local:push

Prod/Tunnel (pakai project yang sudah di‑link):
npm run db:prod:link → pilih project dulu
npm run db:prod:push
npm run db:prod:reset
npm run db:tunnel:push
npm run db:tunnel:reset
