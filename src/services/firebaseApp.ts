/**
 * The one Firebase app (D47 PR 6): the leaderboard and web analytics share it, so neither initializes a second one
 * (Firebase refuses a duplicate default app). Loaded only when a feature that needs it starts.
 */

import { FIREBASE } from '../config/services';

let app: Promise<import('firebase/app').FirebaseApp> | null = null;

export function firebaseApp(): Promise<import('firebase/app').FirebaseApp> {
  app ??= import('firebase/app')
    .then((m) =>
      m.getApps()[0] ??
      m.initializeApp({
        apiKey: FIREBASE.apiKey,
        authDomain: FIREBASE.authDomain || undefined,
        projectId: FIREBASE.projectId,
        appId: FIREBASE.appId,
        ...(FIREBASE.measurementId ? { measurementId: FIREBASE.measurementId } : {}),
      }),
    )
    .catch((e) => {
      app = null;
      throw e;
    });
  return app;
}
