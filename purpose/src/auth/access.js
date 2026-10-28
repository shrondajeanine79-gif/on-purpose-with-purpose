import { verifyJwt, JwtError } from "./jwt.js";

/**
 * Cloudflare Access gate for the PURPOSE dashboard.
 *
 * Two independent checks:
 *   1. The Access JWT must be valid for this application tag and team domain.
 *   2. The identity in the token must be the configured owner.
 *
 * Access alone is never treated as sufficient authorization. The Worker re-verifies
 * the token on every request rather than trusting a cookie or a header alone.
 */

export class AuthError extends Error {
  constructor(code, message, status = 401) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
  }
}

export const ACCESS_HEADER = "cf-access-jwt-assertion";

export function authConfigFromEnv(env = process.env) {
  return {
    teamDomain: env.PURPOSE_ACCESS_TEAM_DOMAIN || "",
    audience: env.PURPOSE_ACCESS_AUD || "",
    ownerEmail: (env.PURPOSE_OWNER_EMAIL || "").trim().toLowerCase(),
    enabled: env.PURPOSE_AUTH_MODE === "access",
  };
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function authenticateRequest({
  headers,
  env = process.env,
  jwks,
  now,
  fetchJwks,
} = {}) {
  const config = authConfigFromEnv(env);

  if (!config.enabled) {
    throw new AuthError(
      "AUTH_NOT_CONFIGURED",
      "Owner authentication is not enabled. Set PURPOSE_AUTH_MODE=access with a team domain, audience, and owner email.",
      503
    );
  }
  if (!config.teamDomain || !config.audience || !config.ownerEmail) {
    throw new AuthError(
      "AUTH_MISCONFIGURED",
      "Access team domain, audience, and owner email must all be set.",
      503
    );
  }

  const token = readHeader(headers, ACCESS_HEADER);
  if (!token) {
    throw new AuthError("AUTH_MISSING", "No Access token was supplied.");
  }

  const keys = jwks ?? (await fetchJwks?.(config.teamDomain));
  if (!keys) {
    throw new AuthError("AUTH_NO_KEYS", "Could not load Access verification keys.", 503);
  }

  let payload;
  try {
    payload = await verifyJwt(token, {
      jwks: keys,
      issuer: `https://${config.teamDomain}`,
      audience: config.audience,
      now,
    });
  } catch (error) {
    if (error instanceof JwtError) {
      throw new AuthError(error.code, error.message, 401);
    }
    throw error;
  }

  const email = normalizeEmail(payload.email);
  if (!email) {
    throw new AuthError("AUTH_NO_IDENTITY", "Token does not identify a user.", 403);
  }
  if (email !== config.ownerEmail) {
    throw new AuthError("AUTH_NOT_OWNER", "This application is restricted to the owner.", 403);
  }

  return {
    email,
    subject: payload.sub ?? null,
    issuer: payload.iss,
    audience: payload.aud,
    issuedAt: payload.iat ?? null,
    expiresAt: payload.exp ?? null,
    role: "owner",
  };
}

function readHeader(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === "function") return headers.get(name);
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key ? headers[key] : null;
}

/**
 * Step-up re-authentication for high-risk capabilities.
 * The Access JWT must have been issued recently, not merely be unexpired.
 */
export function requireStepUp(identity, { now = Date.now(), maxAgeSeconds = 300 } = {}) {
  if (!identity?.issuedAt) {
    throw new AuthError("STEP_UP_REQUIRED", "Re-authenticate before this action.", 403);
  }
  const ageSeconds = Math.floor(now / 1000) - identity.issuedAt;
  if (ageSeconds > maxAgeSeconds) {
    throw new AuthError(
      "STEP_UP_REQUIRED",
      "This action requires a fresh sign-in. Re-authenticate and retry.",
      403
    );
  }
  return true;
}

export async function fetchAccessJwks(teamDomain, { fetchImpl = globalThis.fetch } = {}) {
  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  const response = await fetchImpl(url);
  if (!response.ok) throw new AuthError("AUTH_JWKS_FAILED", "Could not load Access keys.", 503);
  return response.json();
}
