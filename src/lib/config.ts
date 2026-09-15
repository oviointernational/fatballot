// Base origin of the deployed Express API.
// Empty string = same-origin HTTP (local dev via Vite proxy / Vercel rewrite).
// When set (e.g. "https://fatballot-api.onrender.com"), WebSockets connect straight to it
// because Vercel's reverse proxy cannot forward WebSocket upgrades.
export const API_ORIGIN: string = (import.meta.env.VITE_API_URL as string) || '';

export const WS_ORIGIN: string = API_ORIGIN
  ? API_ORIGIN.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')
  : '';