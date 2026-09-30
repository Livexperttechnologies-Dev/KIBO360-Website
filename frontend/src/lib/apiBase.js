// Single place that decides where the backend lives.
// - On the live site (kibo360.in / www.kibo360.in) the API is served from the
//   dedicated subdomain https://api.kibo360.in (CORS on the backend allows it).
// - Everywhere else (localhost dev on 3001, the isolated test server on 4599)
//   requests stay relative so they hit the local backend via the /api proxy.
// - Only the production hosts use the production API. Any other host
//   (staging.kibo360.in, previews) talks to its own origin, so a staging
//   admin can never sign in to - or publish on - the live site by accident.
// - VITE_API_BASE at build time sets the API for every OTHER host (it is
//   ignored on the production hosts, so one build can go staging -> live).
const OVERRIDE = ((import.meta.env && import.meta.env.VITE_API_BASE) || "").replace(/\/$/, "");
const isProductionHost = typeof window !== "undefined" && /^(www\.)?kibo360\.in$/i.test(window.location.hostname);
export const API_BASE = isProductionHost ? "https://api.kibo360.in" : OVERRIDE;
