import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { TRUSTED_PROXIES, isInternalRequest, isPrivateAddress } from "../lib/clientAddress";

describe("isPrivateAddress", () => {
  it("recognises loopback and Docker's private ranges", () => {
    for (const ip of ["127.0.0.1", "10.0.5.5", "172.18.0.7", "172.31.255.1", "192.168.1.10", "::1", "::ffff:172.18.0.7"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("treats everything else as public", () => {
    for (const ip of ["178.105.208.56", "172.15.0.1", "172.32.0.1", "8.8.8.8", "2a01:4f8::1", "", undefined]) {
      expect(isPrivateAddress(ip), String(ip)).toBe(false);
    }
  });
});

describe("isInternalRequest", () => {
  it("is our own server only when there is no X-Forwarded-For AND the socket is private", () => {
    expect(isInternalRequest({ headers: {}, socket: { remoteAddress: "172.18.0.7" } })).toBe(true);
    expect(isInternalRequest({ headers: { "x-forwarded-for": "8.8.8.8" }, socket: { remoteAddress: "172.18.0.7" } })).toBe(false);
    expect(isInternalRequest({ headers: {}, socket: { remoteAddress: "8.8.8.8" } })).toBe(false);
  });
});

// The same wiring as src/index.ts, with a tiny budget.
async function buildApp() {
  const app = Fastify({ logger: false, trustProxy: TRUSTED_PROXIES });
  await app.register(rateLimit, {
    max: 2,
    timeWindow: "1 minute",
    allowList: (request) => isInternalRequest(request),
    keyGenerator: (request) => `ip:${request.ip}`,
  });
  app.get("/ip", async (request) => ({ ip: request.ip }));
  await app.ready();
  return app;
}

describe("rate limit behind the proxy chain", () => {
  // app.inject() connects from 127.0.0.1 -- a trusted hop, like the web container.
  const from = (app: Awaited<ReturnType<typeof buildApp>>, xff?: string) =>
    app.inject({ method: "GET", url: "/ip", headers: xff ? { "x-forwarded-for": xff } : {} });

  it("request.ip is the visitor's address, not the proxy's", async () => {
    const app = await buildApp();
    expect((await from(app, "203.0.113.9")).json().ip).toBe("203.0.113.9");
    // Caddy -> Next: the visitor first, then our own hop.
    expect((await from(app, "203.0.113.9, 172.18.0.3")).json().ip).toBe("203.0.113.9");
  });

  it("each visitor has their own budget", async () => {
    const app = await buildApp();
    expect((await from(app, "203.0.113.1")).statusCode).toBe(200);
    expect((await from(app, "203.0.113.1")).statusCode).toBe(200);
    expect((await from(app, "203.0.113.1")).statusCode).toBe(429);
    // Somebody else is not affected by the first visitor running out.
    expect((await from(app, "203.0.113.2")).statusCode).toBe(200);
  });

  it("our own server's requests are not limited", async () => {
    const app = await buildApp();
    for (let i = 0; i < 5; i++) expect((await from(app)).statusCode).toBe(200);
  });
});
