import { createApp } from '../../src/app';
import type { Application } from 'express';

let app: Application | null = null;

export function getTestApp(): Application {
  if (!app) {
    app = createApp();
  }
  return app;
}

export function resetTestApp(): void {
  app = null;
}
