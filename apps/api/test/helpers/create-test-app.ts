import type { Express } from 'express';
import request from 'supertest';

import { createApp } from '../../src/app';

let cached: Express | null = null;

export function getTestApp(): Express {
  if (!cached) {
    cached = createApp();
  }
  return cached;
}

export function api() {
  return request(getTestApp());
}
