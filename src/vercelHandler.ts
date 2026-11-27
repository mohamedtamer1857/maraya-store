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

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  normalizeVercelApiUrl(req);

  let app: ReturnType<typeof createApiApp>;
  try {
    app = getApiApp();
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Serverless API handler failed to initialize.';
    console.error('Vercel API initialization error:', err);
    sendJsonError(res, 500, message);
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    res.once('finish', done);
    res.once('close', done);

    try {
      app(req as unknown as Request, res as unknown as Response, (err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'Unexpected API routing error.';
        console.error('Unhandled Express pipeline error:', err);
        sendJsonError(res, 500, message);
        done();
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Serverless API request execution failed.';
      console.error('Vercel API runtime error:', err);
      sendJsonError(res, 500, message);
      done();
    }
  });
}
