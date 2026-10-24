import express, { Request, Response } from 'express';
import { motorideRouter } from '../server/motorideRouter';

const app = express();

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Mount router under multiple paths to handle all rewrite variants cleanly
app.use('/api/motoride', motorideRouter);
app.use('/motoride', motorideRouter);
app.use('/', motorideRouter);

export default app;
