IRIS Digital Studio — update package

Files:
- index.html: current website HTML with the production site URL set to https://iris-digital-shop.pages.dev/

Important:
The Worker API URL is not yet known, so API_BASE currently points to the Pages site:
  const API_BASE = SITE_URL;

After deploying the Worker, open index.html in GitHub and change API_BASE to the exact workers.dev URL Cloudflare gives you, e.g.
  const API_BASE = "https://iris-digital-api.YOUR-ACCOUNT.workers.dev";

Do not use the example URL literally. The Worker must also have D1 binding DB -> iris-digital-db and Secret ADMIN_TOKEN configured.
This package does not claim the Worker has been connected or deployed.
