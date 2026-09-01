// Single place that decides where the backend lives.
// - On the live site (kibo360.in / www.kibo360.in) the API is served from the
//   dedicated subdomain https://api.kibo360.in (CORS on the backend allows it).
// - Everywhere else (localhost dev on 3001, the isolated test server on 4599)
//   requests stay relative so they hit the local backend via the /api proxy.
export const API_BASE = /(^|\.)kibo360\.in$/i.test(window.location.hostname)
  ? "https://api.kibo360.in"
  : "";
