import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { quotaGate } from './middleware/quotaGate';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────

/** Health check — used by deploy platforms & load balancers */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/** API root */
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    name: 'PIXELVERSE API',
    version: '1.0.0',
    message: 'Welcome to the arcade. 🕹️',
  });
});

/** Quota gate test route */
app.post('/api/test-quota', quotaGate, (_req: Request, res: Response) => {
  res.json({ message: 'Success! You bypassed the quota gate.' });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🕹️  PIXELVERSE server running on port ${PORT}`);
});

export default app;
