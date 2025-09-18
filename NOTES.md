### Commands
```bash
npx create-nx-workspace --preset=apps
cd aze-mini
nx add @nx/nest
nx add @nx/next
nx g @nx/next:app apps/aze-client
nx g @nx/nest:app apps/aze-api --frontendProject aze-client

cd apps/aze-api
nest g resource products
nest serve

nx dev aze-client


### Prisma
npx prisma init
npx prisma migrate dev
npx prisma generate
```