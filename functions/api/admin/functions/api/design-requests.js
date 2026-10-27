const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

const clean = (value, max = 5000) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[ch]));

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: "Máy chủ chưa được kết nối cơ sở dữ liệu." }, 503);

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ ok: false, error: "Yêu cầu không hợp lệ." }, 415);
  }

  let body;
  try {
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 12000) return json({ ok: false, error: "Nội dung gửi quá lớn." }, 413);
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Dữ liệu gửi không hợp lệ." }, 400);
  }

  // Honeypot chống bot đơn giản; trả kết quả giả thành công nhưng không lưu.
  if (clean(body.website, 200)) return json({ ok: true, emailSent: false });

  const name = clean(body.name, 120);
  const email = clean(body.email, 254).toLowerCase();
  const productType = clean(body.productType, 100);
  const budget = clean(body.budget, 80) || "Chưa xác định";
  const deadline = clean(body.deadline, 10);
  const brief = clean(body.brief, 5000);

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!name || !emailPattern.test(email) || !productType || brief.length < 10) {
    return json({ ok: false, error: "Vui lòng kiểm tra họ tên, email, loại sản phẩm và mô tả (ít nhất 10 ký tự)." }, 400);
  }
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    return json({ ok: false, error: "Ngày mong muốn không hợp lệ." }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(`
      INSERT INTO design_requests
      (id, customer_name, customer_email, product_type, budget, deadline, brief, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)
    `).bind(id, name, email, productType, budget, deadline || null, brief, now, now).run();
  } catch (error) {
    return json({ ok: false, error: "Không lưu được yêu cầu. Hãy kiểm tra đã chạy migration D1 chưa." }, 500);
  }

  let emailSent = false;
  let emailError = "";
  if (env.RESEND_API_KEY && env.DESIGN_REQUEST_FROM) {
    try {
      const html = `
        <h2>Yêu cầu thiết kế mới — IRIS Digital Studio</h2>
        <p><b>Mã yêu cầu:</b> ${escapeHtml(id)}</p>
        <p><b>Khách hàng:</b> ${escapeHtml(name)}</p>
        <p><b>Email:</b> ${escapeHtml(email)}</p>
        <p><b>Loại sản phẩm:</b> ${escapeHtml(productType)}</p>
        <p><b>Ngân sách:</b> ${escapeHtml(budget)}</p>
        <p><b>Thời hạn:</b> ${escapeHtml(deadline || "Chưa xác định")}</p>
        <p><b>Mô tả:</b></p><p>${escapeHtml(brief).replace(/\n/g, "<br>")}</p>`;
      const mailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: env.DESIGN_REQUEST_FROM,
          to: ["contactfor.irisdigital@gmail.com"],
          reply_to: email,
          subject: `IRIS — Yêu cầu thiết kế mới (${productType})`,
          html
        })
      });
      emailSent = mailResponse.ok;
      if (!mailResponse.ok) emailError = `Resend returned ${mailResponse.status}`;
    } catch {
      emailError = "Email provider request failed";
    }
  }

  // If mail delivery is configured but fails, the request is still safely saved in D1.
  return json({
    ok: true,
    requestId: id,
    emailSent,
    message: emailSent
      ? "Đã lưu yêu cầu và gửi thông báo email."
      : "Đã lưu yêu cầu vào hệ thống; email chưa được gửi hoặc chưa được cấu hình."
  }, 201);
}
