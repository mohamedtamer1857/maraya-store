import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request, Response } from 'express';
import { createApiApp } from './apiApp.ts';

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

function sendJsonError(res: ServerResponse, statusCode: number, message: string) {
  if (res.headersSent || res.writableEnded) {
    return;
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: message }));
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    normalizeVercelApiUrl(req);
    const app = getApiApp();
    return app(req as unknown as Request, res as unknown as Response, (err: unknown) => {
      const message =
        err instanceof Error ? err.message : 'Unexpected API routing error.';
      console.error('Unhandled Express pipeline error:', err);
      sendJsonError(res, 500, message);
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Serverless API handler failed to initialize.';
    console.error('Vercel API handler error:', err);
    sendJsonError(res, 500, message);
  }
}
