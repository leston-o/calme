# CalMe Dashboard

React + Vite + Tailwind dashboard for the CalMe API.

```bash
npm install
npm run dev        # http://localhost:3000
```

The dev server proxies `/api` (REST and the live-call WebSocket) to the backend at
`http://localhost:8000`. Point it elsewhere with `CALME_API_URL=http://host:port npm run dev`.

Pages:

- **Overview** – agent/number counts, database status, recent agents
- **Agents** – list, search, create; per agent: settings, voice preview, text test chat,
  live voice call (same protocol as `app/static/live.html`), buy/release/sync phone number
- **Voices** – clone a voice from samples (with consent), check status, play, delete.
  The API has no list endpoint, so voices are remembered in this browser's localStorage.
- **Playground** – raw TTS and STT tests

For production, `npm run build` and serve `dist/` behind a reverse proxy that forwards
`/api` (with WebSocket upgrade) to the backend.
