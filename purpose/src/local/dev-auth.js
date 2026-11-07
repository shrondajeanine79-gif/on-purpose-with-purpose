/**
 * DEV-ONLY ephemeral auth for local dry runs.
 *
 * Generates a throwaway RSA key pair in memory and mints a short-lived token so the
 * real router and the real Access verifier can be exercised without any Cloudflare
 * account, real signing keys, or owner PII.
 *
 * Guards:
 *  - Never reads or writes real authentication environment variables.
 *  - Refuses to run when a real owner email is configured in the ambient environment,
 *    to avoid accidental mixing of dev and production identity.
 *  - Keys live only in this process; nothing is persisted.
 */

import { generateKeyPairSync, createSign, randomUUID } from "node:crypto";

export const DEV_TEAM_DOMAIN = "purpose-dry-run.invalid";
export const DEV_AUDIENCE = "purpose-dry-run-aud";
export const DEV_OWNER_EMAIL = "owner@dry-run.invalid";

function base64Url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function assertSafeDevEnvironment(env = process.env) {
  if (env.PURPOSE_OWNER_EMAIL && !env.PURPOSE_OWNER_EMAIL.endsWith(".invalid")) {
    throw new Error(
      "Refusing to run the dry run while a real PURPOSE_OWNER_EMAIL is configured. Unset it first."
    );
  }
  if (env.PURPOSE_ACCESS_AUD && env.PURPOSE_ACCESS_AUD !== DEV_AUDIENCE) {
    throw new Error(
      "Refusing to run the dry run while a real PURPOSE_ACCESS_AUD is configured. Unset it first."
    );
  }
  return true;
}

export function createDevIdentity() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = publicKey.export({ format: "jwk" });
  const kid = `dry-run-${randomUUID().slice(0, 8)}`;
  const jwks = { keys: [{ ...jwk, kid, alg: "RS256", use: "sig" }] };

  function mint({ overrides = {}, issuedAtOffsetSeconds = 0 } = {}) {
    const now = Math.floor(Date.now() / 1000) + issuedAtOffsetSeconds;
    const header = { alg: "RS256", typ: "JWT", kid };
    const payload = {
      iss: `https://${DEV_TEAM_DOMAIN}`,
      aud: DEV_AUDIENCE,
      email: DEV_OWNER_EMAIL,
      sub: "dry-run-owner",
      iat: now,
      exp: now + 600,
      ...overrides,
    };
    const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
    const signer = createSign("RSA-SHA256");
    signer.update(signingInput);
    return `${signingInput}.${base64Url(signer.sign(privateKey))}`;
  }

  return { jwks, mint, kid };
}

export function dryRunEnv() {
  return {
    PURPOSE_AUTH_MODE: "access",
    PURPOSE_ACCESS_TEAM_DOMAIN: DEV_TEAM_DOMAIN,
    PURPOSE_ACCESS_AUD: DEV_AUDIENCE,
    PURPOSE_OWNER_EMAIL: DEV_OWNER_EMAIL,
    PURPOSE_ENABLE_HIVE: "1",
    HIVE_API_KEY: "dry-run-not-a-real-key",
    HIVE_BASE_URL: "https://dry-run.invalid/api/v3",
  };
}
