import test from "node:test";
import assert from "node:assert/strict";
import { authenticateRequest, requireStepUp, AuthError } from "../src/auth/access.js";
import { verifyJwt, JwtError, checkClaims, parseJwt } from "../src/auth/jwt.js";
import { createKeyPair, mintJwt, TEST_ENV } from "./helpers/jwt-mint.js";

const rs = createKeyPair("RS256");
const es = createKeyPair("ES256");

function headers(token) {
  return { "cf-access-jwt-assertion": token };
}

test("accepts a valid RS256 owner token", async () => {
  const token = mintJwt(rs, {});
  const identity = await authenticateRequest({
    headers: headers(token),
    env: TEST_ENV,
    jwks: rs.jwks,
  });
  assert.equal(identity.role, "owner");
  assert.equal(identity.email, "owner@example.com");
});

test("accepts a valid ES256 owner token", async () => {
  const token = mintJwt(es, {});
  const identity = await authenticateRequest({ headers: headers(token), env: TEST_ENV, jwks: es.jwks });
  assert.equal(identity.role, "owner");
});

test("rejects a missing token", async () => {
  await assert.rejects(
    authenticateRequest({ headers: {}, env: TEST_ENV, jwks: rs.jwks }),
    (error) => error instanceof AuthError && error.code === "AUTH_MISSING"
  );
});

test("rejects a malformed token", async () => {
  await assert.rejects(
    authenticateRequest({ headers: headers("a.b"), env: TEST_ENV, jwks: rs.jwks }),
    (error) => error.code === "JWT_MALFORMED"
  );
});

test("rejects a token signed by a different key", async () => {
  const other = createKeyPair("RS256");
  const token = mintJwt(other, {});
  await assert.rejects(
    authenticateRequest({ headers: headers(token), env: TEST_ENV, jwks: rs.jwks }),
    (error) => error.code === "JWT_SIGNATURE_INVALID"
  );
});

test("rejects a tampered payload", async () => {
  const token = mintJwt(rs, { email: "owner@example.com" });
  const [h, , s] = token.split(".");
  const forged = Buffer.from(
    JSON.stringify({
      iss: "https://purpose-test.cloudflareaccess.com",
      aud: "test-aud-tag",
      email: "attacker@example.com",
      exp: Math.floor(Date.now() / 1000) + 600,
    })
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  await assert.rejects(
    authenticateRequest({ headers: headers(`${h}.${forged}.${s}`), env: TEST_ENV, jwks: rs.jwks }),
    (error) => error.code === "JWT_SIGNATURE_INVALID"
  );
});

test("rejects a non-owner identity", async () => {
  const token = mintJwt(rs, { email: "someone@example.com" });
  await assert.rejects(
    authenticateRequest({ headers: headers(token), env: TEST_ENV, jwks: rs.jwks }),
    (error) => error.code === "AUTH_NOT_OWNER" && error.status === 403
  );
});

test("rejects an expired token", async () => {
  const token = mintJwt(rs, { exp: Math.floor(Date.now() / 1000) - 3600 });
  await assert.rejects(
    authenticateRequest({ headers: headers(token), env: TEST_ENV, jwks: rs.jwks }),
    (error) => error.code === "JWT_EXPIRED"
  );
});

test("rejects a wrong audience", async () => {
  const token = mintJwt(rs, { aud: "other-aud" });
  await assert.rejects(
    authenticateRequest({ headers: headers(token), env: TEST_ENV, jwks: rs.jwks }),
    (error) => error.code === "JWT_AUD_MISMATCH"
  );
});

test("rejects a wrong issuer", async () => {
  const token = mintJwt(rs, { iss: "https://evil.cloudflareaccess.com" });
  await assert.rejects(
    authenticateRequest({ headers: headers(token), env: TEST_ENV, jwks: rs.jwks }),
    (error) => error.code === "JWT_ISS_MISMATCH"
  );
});

test("rejects an unsigned alg=none token", async () => {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ email: "owner@example.com", exp: 9999999999 })).toString("base64url");
  await assert.rejects(
    authenticateRequest({ headers: headers(`${header}.${payload}.`), env: TEST_ENV, jwks: rs.jwks }),
    (error) => error.code === "JWT_ALG_UNSUPPORTED" || error.code === "JWT_KEY_NOT_FOUND"
  );
});

test("authentication is disabled unless PURPOSE_AUTH_MODE=access", async () => {
  await assert.rejects(
    authenticateRequest({ headers: headers(mintJwt(rs, {})), env: { ...TEST_ENV, PURPOSE_AUTH_MODE: "" }, jwks: rs.jwks }),
    (error) => error.code === "AUTH_NOT_CONFIGURED" && error.status === 503
  );
});

test("authentication fails closed when config is incomplete", async () => {
  await assert.rejects(
    authenticateRequest({
      headers: headers(mintJwt(rs, {})),
      env: { ...TEST_ENV, PURPOSE_OWNER_EMAIL: "" },
      jwks: rs.jwks,
    }),
    (error) => error.code === "AUTH_MISCONFIGURED"
  );
});

test("clock skew is bounded for expiry", () => {
  const now = 1_800_000_000_000;
  const payload = { exp: Math.floor(now / 1000) - 30 };
  assert.equal(checkClaims(payload, { now }), true);
  assert.throws(() => checkClaims(payload, { now: now + 120_000 }), JwtError);
});

test("parseJwt refuses a two-part token", () => {
  assert.throws(() => parseJwt("abc.def"), (error) => error.code === "JWT_MALFORMED");
});

test("verifyJwt returns claims for a valid token", async () => {
  const token = mintJwt(rs, { custom: "value" });
  const payload = await verifyJwt(token, {
    jwks: rs.jwks,
    issuer: "https://purpose-test.cloudflareaccess.com",
    audience: "test-aud-tag",
  });
  assert.equal(payload.custom, "value");
});

test("step-up requires a recent sign-in", () => {
  const now = Date.now();
  assert.equal(requireStepUp({ issuedAt: Math.floor(now / 1000) - 10 }, { now }), true);
  assert.throws(
    () => requireStepUp({ issuedAt: Math.floor(now / 1000) - 3600 }, { now }),
    (error) => error.code === "STEP_UP_REQUIRED"
  );
  assert.throws(() => requireStepUp({}, { now }), (error) => error.code === "STEP_UP_REQUIRED");
});
