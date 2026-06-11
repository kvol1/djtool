FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

RUN bun install

COPY . .

RUN bun run build

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["bun", "run", "start"]
