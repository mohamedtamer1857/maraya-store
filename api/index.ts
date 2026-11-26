import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiApp } from '../src/apiApp.ts';

let cachedApp: ReturnType<typeof createApiApp> | null = null;

function getApiApp() {
  if (!cachedApp) {
    cachedApp = createApiApp();
  }
  return cachedApp;
}

function normalizeVercelApiUrl(req: IncomingMessage) {
  const rawUrl = req.url || '/api';
  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    const rewrittenPath = parsed.searchParams.get('__maraya_path');
    if (rewrittenPath !== null) {
      parsed.searchParams.delete('__maraya_path');
      const cleaned = rewrittenPath.replace(/^\/+/, '');
      const nextPathname = cleaned ? `/api/${cleaned}` : '/api';
      const nextSearch = parsed.searchParams.toString();
      req.url = nextSearch ? `${nextPathname}?${nextSearch}` : nextPathname;
      return;
    }

    if (parsed.pathname === '/api/index') {
      const nextSearch = parsed.searchParams.toString();
      req.url = nextSearch ? `/api?${nextSearch}` : '/api';
    }
  } catch {
    // Keep original req.url if URL parsing fails
  }
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  normalizeVercelApiUrl(req);
  const app = getApiApp();
  return app(req, res);
}
