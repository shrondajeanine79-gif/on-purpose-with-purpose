/**
 * JWT verification with WebCrypto only. No dependencies.
 * Supports RS256 and ES256, which are the algorithms Cloudflare Access uses.
 */

const encoder = new TextEncoder();

export class JwtError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "JwtError";
    this.code = code;
  }
}

export function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson(segment, label) {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment)));
  } catch {
    throw new JwtError("JWT_MALFORMED", `The ${label} segment is not valid base64url JSON.`);
  }
}

const ALGORITHMS = {
  RS256: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
  ES256: { name: "ECDSA", hash: "SHA-256", namedCurve: "P-256" },
};

export function parseJwt(token) {
  if (typeof token !== "string") throw new JwtError("JWT_MISSING", "No token was supplied.");
  const parts = token.split(".");
  if (parts.length !== 3) throw new JwtError("JWT_MALFORMED", "A JWT must have three segments.");
  const [rawHeader, rawPayload, rawSignature] = parts;
  return {
    header: decodeJson(rawHeader, "header"),
    payload: decodeJson(rawPayload, "payload"),
    signature: base64UrlToBytes(rawSignature),
    signingInput: encoder.encode(`${rawHeader}.${rawPayload}`),
  };
}

export async function importJwk(jwk) {
  const spec = ALGORITHMS[jwk.alg];
  if (!spec) throw new JwtError("JWT_ALG_UNSUPPORTED", `Key algorithm ${jwk.alg} is not supported.`);
  const algorithm = spec.namedCurve
    ? { name: spec.name, namedCurve: spec.namedCurve }
    : { name: spec.name, hash: spec.hash };
  return crypto.subtle.importKey("jwk", jwk, algorithm, false, ["verify"]);
}

export async function verifySignature({ header, signature, signingInput, jwks }) {
  const spec = ALGORITHMS[header.alg];
  if (!spec) throw new JwtError("JWT_ALG_UNSUPPORTED", `Algorithm ${header.alg} is not allowed.`);

  const candidates = (jwks?.keys ?? []).filter((key) => {
    if (key.kid && header.kid) return key.kid === header.kid;
    return key.alg === header.alg;
  });

  if (candidates.length === 0) {
    throw new JwtError("JWT_KEY_NOT_FOUND", "No matching verification key was found.");
  }

  for (const jwk of candidates) {
    const key = await importJwk(jwk);
    const algorithm = spec.namedCurve
      ? { name: spec.name, hash: spec.hash }
      : { name: spec.name };
    const ok = await crypto.subtle.verify(algorithm, key, signature, signingInput);
    if (ok) return true;
  }

  throw new JwtError("JWT_SIGNATURE_INVALID", "Token signature verification failed.");
}

export function checkClaims(payload, { issuer, audience, now = Date.now(), clockSkewSeconds = 60 }) {
  const nowSeconds = Math.floor(now / 1000);
  const skew = clockSkewSeconds;

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (audience) {
    const targets = Array.isArray(audience) ? audience : [audience];
    if (!targets.some((target) => audiences.includes(target))) {
      throw new JwtError("JWT_AUD_MISMATCH", "Token audience does not match this application.");
    }
  }

  if (issuer) {
    const expected = issuer.endsWith("/") ? issuer : `${issuer}/`;
    if (payload.iss !== issuer && payload.iss !== expected) {
      throw new JwtError("JWT_ISS_MISMATCH", "Token issuer does not match the expected team domain.");
    }
  }

  if (typeof payload.exp !== "number") {
    throw new JwtError("JWT_NO_EXP", "Token has no expiry.");
  }
  if (payload.exp + skew < nowSeconds) {
    throw new JwtError("JWT_EXPIRED", "Token has expired.");
  }

  if (typeof payload.nbf === "number" && payload.nbf - skew > nowSeconds) {
    throw new JwtError("JWT_NOT_YET_VALID", "Token is not valid yet.");
  }

  if (typeof payload.iat === "number" && payload.iat - skew > nowSeconds) {
    throw new JwtError("JWT_IAT_FUTURE", "Token was issued in the future.");
  }

  return true;
}

export async function verifyJwt(token, { jwks, issuer, audience, now } = {}) {
  const parsed = parseJwt(token);
  await verifySignature({ ...parsed, jwks });
  checkClaims(parsed.payload, { issuer, audience, now });
  return parsed.payload;
}
