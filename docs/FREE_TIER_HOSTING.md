# OpenBot: 100% Free Tier Hosting (Zero Credit Card Required)

> **No Credit Card or Debit Card Needed**: You can host and run OpenBot 100% free with zero payment details. Every service in this stack signs up directly using **GitHub** or **Google**.

## Option A — Free-tier Docker stack (this repo)

The repo ships a minimal compose file with just the web app and its data
services:

```bash
docker-compose -f docker-compose.free-tier.yml up -d
```

It starts:

| Service | Image | Purpose |
|---|---|---|
| `openbot-web` | built from `apps/web` | Next.js UI + API routes |
| `openbot-postgres` | `postgres:16-alpine` | Database (Prisma) |
| `openbot-redis` | `redis:7-alpine` | Cache / queues |
| `openbot-ollama` | `ollama/ollama:latest` | Local model inference (Zero-Cloud) |

The full stack (including the NestJS services) is in `docker-compose.yml`.

## Option B — Free cloud providers (no card)

### Verified Zero-Card Providers:
1. **[Vercel](https://vercel.com)**: Fullstack Next.js 15 Web App + APIs (GitHub sign-in, No card).
2. **[Hugging Face Spaces](https://huggingface.co/spaces)**: 16 GB RAM Docker Container (GitHub sign-in, No card).
3. **[Neon.tech](https://neon.tech)**: Serverless PostgreSQL (GitHub sign-in, No card).
4. **[Supabase](https://supabase.com)**: PostgreSQL + `pgvector` + Auth (GitHub sign-in, No card).
5. **[Groq Cloud](https://console.groq.com)**: Llama 3.3 70B & DeepSeek R1 API (Google/GitHub sign-in, No card).
6. **[Google AI Studio](https://aistudio.google.com)**: Gemini 2.0 Flash 1,500 req/day (Google sign-in, No card).
7. **[Cloudflare Tunnels](https://developers.cloudflare.com)**: Public HTTPS URL for laptop/phone (Zero card, No port forwarding).

A typical free deployment: web app on Vercel, PostgreSQL on Neon or Supabase,
inference via Groq / Google AI Studio keys added in Settings → API Keys, and
a Cloudflare Tunnel if you want to expose a home machine's Ollama securely.
