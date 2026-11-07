import { generateKeyPairSync, createSign, sign } from "node:crypto";

/**
 * Test-only JWT minting. Mirrors Cloudflare Access claim shape.
 * No real keys or secrets are used.
 */

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createKeyPair(kind = "RS256") {
  if (kind === "RS256") {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwk = publicKey.export({ format: "jwk" });
    return {
      kind,
      privateKey,
      publicJwk: { ...jwk, kid: "test-key-1", alg: "RS256", use: "sig" },
      jwks: { keys: [{ ...jwk, kid: "test-key-1", alg: "RS256", use: "sig" }] },
    };
  }
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" });
  return {
    kind,
    privateKey,
    publicJwk: { ...jwk, kid: "test-key-1", alg: "ES256", use: "sig" },
    jwks: { keys: [{ ...jwk, kid: "test-key-1", alg: "ES256", use: "sig" }] },
  };
}

export function mintJwt(keys, claims, { header = {} } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const fullHeader = {
    alg: keys.kind,
    typ: "JWT",
    kid: "test-key-1",
    ...header,
  };
  const payload = {
    iss: "https://purpose-test.cloudflareaccess.com",
    aud: "test-aud-tag",
    email: "owner@example.com",
    sub: "owner-sub",
    iat: now,
    exp: now + 600,
    ...claims,
  };
  const signingInput = `${base64Url(JSON.stringify(fullHeader))}.${base64Url(JSON.stringify(payload))}`;

  let signature;
  if (keys.kind === "RS256") {
    const signer = createSign("RSA-SHA256");
    signer.update(signingInput);
    signature = signer.sign(keys.privateKey);
  } else {
    signature = sign("sha256", Buffer.from(signingInput), {
      key: keys.privateKey,
      dsaEncoding: "ieee-p1363",
    });
  }

  return `${signingInput}.${base64Url(signature)}`;
}

export const TEST_ENV = {
  PURPOSE_AUTH_MODE: "access",
  PURPOSE_ACCESS_TEAM_DOMAIN: "purpose-test.cloudflareaccess.com",
  PURPOSE_ACCESS_AUD: "test-aud-tag",
  PURPOSE_OWNER_EMAIL: "owner@example.com",
};
