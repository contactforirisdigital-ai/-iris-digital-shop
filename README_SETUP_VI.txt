IRIS Digital Studio — Design Request Intake

Package contents
- index.html: FAQ updated and custom-design brief form connected to POST /api/design-requests.
- functions/api/design-requests.js: Cloudflare Pages Function. Validates input, saves it to D1, and optionally sends an email using Resend.
- migrations/001_create_design_requests.sql: D1 table migration.

IMPORTANT: The ZIP is prepared but is not deployed to GitHub/Cloudflare by this process.

Deployment steps
1. In Cloudflare Dashboard > D1 > iris-digital-db > Console, run the SQL in migrations/001_create_design_requests.sql once.
2. Upload/commit index.html and functions/api/design-requests.js into the repository, preserving the `functions/api/` directory structure.
3. Commit to branch main and wait for Cloudflare Pages deployment success.
4. Test the form with a sample request, then verify the row exists in the design_requests table.

Email setup
- Email notifications use Resend API.
- Add Cloudflare Pages environment secrets/variables:
  * RESEND_API_KEY (Secret): your Resend API key.
  * DESIGN_REQUEST_FROM (Variable): a sender address/domain verified in Resend, e.g. IRIS <requests@your-verified-domain.example>.
- The recipient is currently contactfor.irisdigital@gmail.com.
- Do not put the API key in index.html or commit it to GitHub.
- If the Resend variables are absent or delivery fails, the request still saves to D1 and the API returns emailSent:false. Verify the row in D1.
- Gmail recipient alone does not authorize Resend to send from Gmail; use a sender identity verified in Resend.

Operational/security notes
- Public endpoint includes input validation and a honeypot, but no full rate limiter or CAPTCHA. Add rate limiting before broad production use.
- This package only implements public request submission. It does not add an admin UI for listing/updating requests; status and notes are stored for a future admin feature.
- Current admin interface is separate and this change is limited to the custom design request flow and the related FAQ.
