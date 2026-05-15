import { createServer } from "node:http";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { config } from "dotenv";
import { id, init } from "@instantdb/admin";

config();

const scrypt = promisify(scryptCallback);
const ownerEmail = "milanovic.sini@gmail.com";
const port = Number(process.env.AUTH_SERVER_PORT || 8787);

const db = init({
  appId: process.env.EXPO_PUBLIC_INSTANT_APP_ID,
  adminToken: process.env.INSTANT_APP_ADMIN_TOKEN,
});

const jsonHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
  "content-type": "application/json",
};

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function sendJson(res, status, body) {
  res.writeHead(status, jsonHeaders);
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  return rawBody ? JSON.parse(rawBody) : {};
}

async function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const key = await scrypt(password, salt, 64);
  return { salt, passwordHash: key.toString("hex") };
}

async function verifyPassword(password, salt, passwordHash) {
  const candidate = await hashPassword(password, salt);
  const expected = Buffer.from(passwordHash, "hex");
  const actual = Buffer.from(candidate.passwordHash, "hex");

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function findUserByEmail(email) {
  const data = await db.query({ $users: {} });
  return data.$users.find((user) => normalizeEmail(user.email) === email);
}

async function findCredentialByUsername(username) {
  const normalizedUsername = normalizeUsername(username);
  const data = await db.query({ userCredentials: {} });

  return data.userCredentials.find(
    (credential) => credential.normalizedUsername === normalizedUsername,
  );
}

async function upsertCredential({ username, email, password }) {
  const normalizedUsername = normalizeUsername(username);
  const existing = await findCredentialByUsername(username);

  if (existing && normalizeEmail(existing.email) !== email) {
    return { error: "This username is already registered." };
  }

  const passwordParts = await hashPassword(password);
  const credentialId = existing?.id || id();

  await db.transact(
    db.tx.userCredentials[credentialId].update({
      username: username.trim(),
      normalizedUsername,
      email,
      passwordHash: passwordParts.passwordHash,
      salt: passwordParts.salt,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    }),
  );

  return { ok: true };
}

function validateCredentialsInput({ username, password }) {
  if (!username || String(username).trim().length < 2) {
    return "Enter a username with at least 2 letters.";
  }

  if (!password || String(password).length < 6) {
    return "Enter a password with at least 6 characters.";
  }

  return null;
}

async function handleLogin(req, res) {
  const body = await readJson(req);
  const inputError = validateCredentialsInput(body);

  if (inputError) {
    sendJson(res, 400, { error: inputError });
    return;
  }

  const credential = await findCredentialByUsername(body.username);

  if (!credential) {
    sendJson(res, 401, { error: "Username or password is wrong." });
    return;
  }

  const passwordMatches = await verifyPassword(
    body.password,
    credential.salt,
    credential.passwordHash,
  );

  if (!passwordMatches) {
    sendJson(res, 401, { error: "Username or password is wrong." });
    return;
  }

  const email = normalizeEmail(credential.email);
  const user = await findUserByEmail(email);
  const isOwner = email === ownerEmail;

  if (!user || (!isOwner && user.status !== "approved")) {
    sendJson(res, 403, { error: "This user is not approved yet." });
    return;
  }

  const token = await db.auth.createToken({ email });
  sendJson(res, 200, { token });
}

async function handleRegister(req, res) {
  const body = await readJson(req);
  const email = normalizeEmail(body.email);
  const inputError = validateCredentialsInput(body);

  if (inputError || !email || !body.code) {
    sendJson(res, 400, {
      error: inputError || "Enter email, password, and the login code.",
    });
    return;
  }

  const isOwner = email === ownerEmail;
  const { user, created } = await db.auth.checkMagicCode(email, String(body.code), {
    extraFields: {
      username: String(body.username).trim(),
      status: isOwner ? "approved" : "pending",
      role: isOwner ? "admin" : "member",
      joinedAt: Date.now(),
    },
  });

  if (!isOwner && !created) {
    await db.transact(
      db.tx.$users[user.id].update({
        username: String(body.username).trim(),
        status: "pending",
        role: "member",
      }),
    );
  }

  const credentialResult = await upsertCredential({
    username: String(body.username),
    email,
    password: String(body.password),
  });

  if (credentialResult.error) {
    sendJson(res, 409, { error: credentialResult.error });
    return;
  }

  const token = await db.auth.createToken({ email });
  sendJson(res, 200, { token });
}

async function route(req, res) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  try {
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && req.url === "/login") {
      await handleLogin(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/register") {
      await handleRegister(req, res);
      return;
    }

    sendJson(res, 404, { error: "Not found." });
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Server error.",
    });
  }
}

createServer(route).listen(port, () => {
  console.log(`Auth server listening on http://localhost:${port}`);
});
