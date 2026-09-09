# Portal dos Consultores

## Development

You need [Bun](https://bun.sh) installed.

```sh
git clone <this-repository-url>
cd portal-consultores
bun install
bun run dev
```

Copy `.env.example` to `.env` and fill in your Supabase project credentials before running the app.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- Supabase (Postgres, Auth, Storage)

## Deployment

The app deploys to [Vercel](https://vercel.com) via the [Nitro](https://v3.nitro.build/) Vite plugin (`nitro/vite`, `vercel` preset). Pushing to the connected branch triggers a new deployment.
