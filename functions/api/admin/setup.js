const encoder = new TextEncoder();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
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

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 310000;

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
  }, key, 256);

  return `pbkdf2$${iterations}$${toBase64Url(salt)}$${toBase64Url(new Uint8Array(bits))}`;
}

function constantTimeEqual(a, b) {
  const aa = encoder.encode(a);
  const bb = encoder.encode(b);
  let diff = aa.length ^ bb.length;
  const length = Math.max(aa.length, bb.length);

  for (let i = 0; i < length; i++) {
    diff |= (aa[i] || 0) ^ (bb[i] || 0);
  }

  return diff === 0;
}

export async function onRequestPost({ request, env }) {
  if (!env.DB || !env.ADMIN_TOKEN) {
    return json({ error: "Server chưa cấu hình DB hoặc ADMIN_TOKEN." }, 500);
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return json({ error: "Yêu cầu phải dùng JSON." }, 415);
  }

  // Chỉ nhận request từ đúng website production.
  const origin = request.headers.get("Origin");
  const expectedOrigin = new URL(request.url).origin;

  if (origin && origin !== expectedOrigin) {
    return json({ error: "Origin không hợp lệ." }, 403);
  }

  const auth = request.headers.get("Authorization") || "";
  const suppliedToken = auth.startsWith("Bearer ")
    ? auth.slice(7)
    : "";

  if (!suppliedToken ||
      !constantTimeEqual(suppliedToken, env.ADMIN_TOKEN)) {
    return json({ error: "Không được phép." }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON không hợp lệ." }, 400);
  }

  const email = typeof body.email === "string"
    ? body.email.trim().toLowerCase()
    : "";
  const password = typeof body.password === "string"
    ? body.password
    : "";

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    password.length < 12 ||
    password.length > 1024
  ) {
    return json({
      error: "Email không hợp lệ hoặc mật khẩu phải dài ít nhất 12 ký tự."
    }, 400);
  }

  try {
    const existing = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM admin_users"
    ).first();

    if (Number(existing?.total || 0) > 0) {
      return json({
        error: "Đã có tài khoản admin. API khởi tạo bị khóa."
      }, 409);
    }

    const passwordHash = await hashPassword(password);
    const id = crypto.randomUUID();

    // INSERT có điều kiện để tránh tạo thêm admin nếu có request đồng thời.
    const result = await env.DB.prepare(`
      INSERT INTO admin_users
        (id, email, password_hash, role, is_active)
      SELECT ?, ?, ?, 'admin', 1
      WHERE NOT EXISTS (SELECT 1 FROM admin_users)
    `).bind(id, email, passwordHash).run();

    if (!result.success || Number(result.meta?.changes || 0) !== 1) {
      return json({
        error: "Không thể tạo admin; hãy kiểm tra trạng thái tài khoản."
      }, 409);
    }

    await env.DB.prepare(`
      INSERT INTO admin_audit_log
        (id, admin_user_id, action, target_type, target_id)
      VALUES (?, ?, 'admin_initialized', 'admin_user', ?)
    `).bind(crypto.randomUUID(), id, id).run();

    return json({
      ok: true,
      message: "Đã tạo tài khoản admin đầu tiên. Hãy xóa hoặc vô hiệu hóa endpoint setup ngay."
    }, 201);
  } catch {
    return json({ error: "Không thể khởi tạo tài khoản." }, 500);
  }
}
