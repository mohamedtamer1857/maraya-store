import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Auth } from 'firebase-admin/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_FALLBACK_PROJECT_ID = 'studious-abstraction-w2ts5';

function resolveProjectId(): string {
  const envProjectId = (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    ''
  ).trim();
  if (envProjectId && envProjectId !== 'remixed-project-id') {
    return envProjectId;
  }

  const candidatePaths = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(__dirname, '../../firebase-applet-config.json'),
    path.resolve(__dirname, '../firebase-applet-config.json'),
  ];

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        const raw = fs.readFileSync(candidate, 'utf8');
        const parsed = JSON.parse(raw) as { projectId?: string };
        if (parsed.projectId && parsed.projectId !== 'remixed-project-id') {
          return parsed.projectId;
        }
      }
    } catch {
      // Try next candidate path
    }
  }

  return PUBLIC_FALLBACK_PROJECT_ID;
}

function getOrInitAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  const projectId = resolveProjectId();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (clientEmail && privateKey) {
    return initializeApp({
      projectId,
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  return initializeApp({
    projectId,
  });
}

export function getAdminAuth(): Auth {
  return getAuth(getOrInitAdminApp());
}
