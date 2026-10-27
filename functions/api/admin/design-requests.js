
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

async function sha256(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return toBase64Url(new Uint8Array(digest));
}

async function getAdmin(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)iris_admin_session=([^;]+)/);

  if (!match || !env.DB) return null;

  const tokenHash = await sha256(decodeURIComponent(match[1]));

  return await env.DB.prepare(`
    SELECT u.id, u.email
    FROM admin_sessions s
    JOIN admin_users u ON u.id = s.admin_user_id
    WHERE s.session_token_hash = ?
      AND s.expires_at > ?
      AND u.is_active = 1
    LIMIT 1
  `).bind(tokenHash, new Date().toISOString()).first();
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return json({ error: "Database chưa được cấu hình." }, 500);
  }

  try {
    const admin = await getAdmin(request, env);

    if (!admin) {
      return json({ error: "Vui lòng đăng nhập quản trị." }, 401);
    }

    const { results } = await env.DB.prepare(`
      SELECT
        id,
        customer_name,
        customer_email,
        product_type,
        budget,
        deadline,
        brief,
        status,
        created_at,
        updated_at
      FROM design_requests
      ORDER BY created_at DESC
      LIMIT 200
    `).all();

    return json({
      ok: true,
      admin: { email: admin.email },
      requests: results
    });
  } catch (error) {
    return json({ error: "Không thể tải danh sách yêu cầu." }, 500);
  }
}
