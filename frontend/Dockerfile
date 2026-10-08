# VetData web (Next.js 16 + pnpm).
# Contexto = frontend/. Build multi-stage: el builder compila con
# output: 'standalone' y el runner conserva solo el bundle trazado +
# .next/static, servido con `node server.js` en el puerto 3000.
FROM node:22-alpine AS builder
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .

# NEXT_PUBLIC_* se bakean en el build de Next. Vienen como ARG desde compose.
# NEXT_PUBLIC_API_URL default = nombre de servicio compose (api:4000).
ARG NEXT_PUBLIC_DATA_SOURCE=mock
ARG NEXT_PUBLIC_API_URL=http://api:4000
ENV NEXT_PUBLIC_DATA_SOURCE=$NEXT_PUBLIC_DATA_SOURCE
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
