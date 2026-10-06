// Who is really on the other end of a request.
//
// Nothing reaches this API straight from the internet: a browser request goes
// Caddy -> the Next.js server (rewrite proxy) -> here, so the socket always
// belongs to the `web` container. Caddy writes the visitor's address into
// X-Forwarded-For (replacing whatever the visitor sent, so it can't be
// faked) and Next passes it on. With TRUSTED_PROXIES given to Fastify's
// `trustProxy`, `request.ip` is that visitor address.

// Our own hops: loopback and the private ranges Docker networks live in.
export const TRUSTED_PROXIES = ["127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "::1"];

export function isPrivateAddress(address: string | undefined): boolean {
  if (!address) return false;
  const ip = address.startsWith("::ffff:") ? address.slice(7) : address;
  if (ip === "::1") return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

// A request made by our own servers rather than by a visitor: it comes from
// inside the private network and carries no X-Forwarded-For at all. That is
// the Next.js server rendering a store page (its fetches to /api/store/*)
// and Prometheus scraping /api/metrics. A visitor's request can't look like
// this -- it always passes Caddy, which always adds the header.
export function isInternalRequest(request: {
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
}): boolean {
  return !request.headers["x-forwarded-for"] && isPrivateAddress(request.socket.remoteAddress);
}
