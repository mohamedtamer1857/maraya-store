import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

if (!firebaseConfig.projectId || firebaseConfig.projectId === 'remixed-project-id') {
  throw new Error('Firebase project configuration is missing or placeholder.');
}

const adminApp = getApps().length
  ? getApp()
  : initializeApp({
      projectId: firebaseConfig.projectId,
    });

export const adminAuth = getAuth(adminApp);
