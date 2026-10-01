// What has run in this browser page so far. The public site's layout sets
// `publicRendered`; Super Admin uses it to start in a fresh page when someone
// arrives from the public site (where header/footer scripts may have run).
export const pageBoot = { publicRendered: false };
