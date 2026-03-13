Overwrite package.json with the included file.

Only change:
- scripts.build = "next build"

Do NOT change your Render Build Command.
Your current Build Command can stay as:
npm ci && npx prisma generate && npx prisma db push && npm run build

Reason:
Your old package.json build script also ran prisma generate && prisma db push.
That made Prisma run twice and can make Render look stuck.
