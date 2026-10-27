
const encoder = new TextEncoder();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

async function sha256(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(value)
  );
  return toBase64Url(new Uint8Array(digest));
}

async function verifyPassword(password, stored) {
  try {
    // Format: pbkdf2$iterations$saltBase64Url$hashBase64Url
    const parts = stored.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

    const iterations = Number(parts[1]);
    if (
      !Number.isInteger(iterations) ||
      iterations < 100000 ||
      iterations > 600000
    ) return false;

    const salt = fromBase64Url(parts[2]);
    const expected = fromBase64Url(parts[3]);

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    const bits = await crypto.subtle.deriveBits({
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256"
    }, key, expected.length * 8);

    const actual = new Uint8Array(bits);
    if (actual.length !== expected.length) return false;

    let diff = 0;
    for (let i = 0; i < actual.length; i++) {
      diff |= actual[i] ^ expected[i];
    }
    return diff === 0;
  } catch {
    return false;
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return json({ error: "Database chưa được cấu hình." }, 500);
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return json({ error: "Yêu cầu không hợp lệ." }, 415);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Dữ liệu không hợp lệ." }, 400);
  }

  const email = typeof body.email === "string"
    ? body.email.trim().toLowerCase()
    : "";
  const password = typeof body.password === "string"
    ? body.password
    : "";

  if (
    !email ||
    !password ||
    email.length > 254 ||
    password.length > 1024
  ) {
    return json({ error: "Vui lòng kiểm tra email và mật khẩu." }, 400);
  }

  try {
    const admin = await env.DB.prepare(
      `SELECT id, email, password_hash
       FROM admin_users
       WHERE email = ? COLLATE NOCASE
         AND is_active = 1
       LIMIT 1`
    ).bind(email).first();

    if (!admin || !(await verifyPassword(password, admin.password_hash))) {
      return json({ error: "Email hoặc mật khẩu không đúng." }, 401);
    }

    const random = crypto.getRandomValues(new Uint8Array(32));
    const sessionToken = toBase64Url(random);
    const tokenHash = await sha256(sessionToken);
    const sessionId = crypto.randomUUID();

    const now = new Date();
    const expires = new Date(now.getTime() + 8 * 60 * 60 * 1000);

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO admin_sessions
          (id, admin_user_id, session_token_hash, expires_at)
         VALUES (?, ?, ?, ?)`
      ).bind(sessionId, admin.id, tokenHash, expires.toISOString()),

      env.DB.prepare(
        `UPDATE admin_users
         SET last_login_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(admin.id),

      env.DB.prepare(
        `INSERT INTO admin_audit_log
          (id, admin_user_id, action, target_type, target_id)
         VALUES (?, ?, 'login_success', 'admin_user', ?)`
      ).bind(crypto.randomUUID(), admin.id, admin.id)
    ]);

    return json(
      { ok: true, message: "Đăng nhập thành công." },
      200,
      {
        "Set-Cookie":
          `iris_admin_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${expires.toUTCString()}`
      }
    );
  } catch (error) {
    return json({ error: "Không thể xử lý đăng nhập lúc này." }, 500);
  }
}
