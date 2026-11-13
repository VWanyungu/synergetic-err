import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import helmetImport from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import 'dotenv/config';
import './types.js';
import checkVersion from './middlewares/version.js';

// shortcut: some type-checking setups infer helmet's default export as the whole module
// namespace instead of the callable default; cast past it.
const helmet = helmetImport as unknown as (options?: Record<string, unknown>) => RequestHandler;

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
// shortcut: one 15 MB body limit for every route so risk attachments can arrive as base64 JSON; move uploads to multipart (multer) or a per-route parser if other routes should stay small.
app.use(express.json({ limit: '15mb' }));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'success', data: null, message: 'ok' });
});

app.use(checkVersion());

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  const status = typeof err?.status === 'number' ? err.status : 500;
  const message = err?.expose ? err.message : 'Internal server error';
  res.status(status).json({ status: 'error', data: null, message });
};
app.use(errorHandler);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`App live on port ${port}`);
});
