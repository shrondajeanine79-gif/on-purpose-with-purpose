import { createRouter } from "../api/router.js";
import { AuditChain } from "../store/audit-chain.js";
import { ApprovalRepository } from "../store/approvals.js";
import { DirectiveRepository, UsageRepository } from "../store/directives.js";
import { ConfigStore } from "../store/config.js";
import { loadBrandStandard, loadGovernance } from "../config.js";

/**
 * Local Worker harness. Mirrors the production composition:
 *   d1 -> stores -> router
 * Run with: node src/local/server.js
 */
const PORT = Number(process.env.PORT ?? 8787);

export function createLocalApp({ db, env = process.env, jwks, fetchImpl, now, configOverride } = {}) {
  const stores = {
    audit: new AuditChain(db),
    approvals: new ApprovalRepository(db),
    directives: new DirectiveRepository(db),
    usage: new UsageRepository(db),
    config: new ConfigStore(db),
  };

  async function loadConfig() {
    const seeded = await stores.config.ensureSeeded({
      brandStandard: configOverride?.brandStandard ?? loadBrandStandard(),
      governance: configOverride?.governance ?? loadGovernance(),
    });
    void seeded;
    return stores.config.active();
  }

  const route = createRouter({
    stores,
    env,
    loadConfig,
    jwks,
    fetchImpl,
    now,
  });

  return { route, stores };
}

if (process.argv[1] && process.argv[1].endsWith("server.js")) {
  const { createServer } = await import("node:http");
  const { createMemoryD1 } = await import("../d1.js");
  const db = createMemoryD1();
  const { route } = createLocalApp({ db });

  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`http://localhost:${PORT}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: body && req.method !== "GET" && req.method !== "HEAD" ? body : undefined,
    });
    const response = await route(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  });

  server.listen(PORT, () => {
    process.stdout.write(`PURPOSE local API on http://localhost:${PORT}\n`);
    process.stdout.write("Owner auth is enforced. Set PURPOSE_AUTH_MODE=access and Access env vars.\n");
    process.stdout.write("Nothing is published, sent, charged, booked, or deployed.\n");
  });
}
