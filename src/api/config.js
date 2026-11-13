// Where the API lives. Blank in development: the Vite dev proxy forwards /api (vite.config.js).
//   VITE_API_BASE=https://api.example.com   → production
export const API_BASE = import.meta.env.VITE_API_BASE ?? "";
