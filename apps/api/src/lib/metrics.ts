import { collectDefaultMetrics, Registry } from "prom-client";

export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, prefix: "knyha_" });
