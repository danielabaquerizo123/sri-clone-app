import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

import authRoutes from './routes/auth.routes';
import contribuyenteRoutes from './routes/contribuyente.routes';
import declaracionRoutes from './routes/declaracion.routes';
import anexoRoutes from './routes/anexo.routes';
import atsRoutes from './routes/ats.routes';
import contabilidadRoutes from './routes/contabilidad.routes';
import adminRoutes from './routes/admin.routes';
import { requireAuth } from './middlewares/auth.middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SRI Clone API - Documentación Transaccional',
      version: '1.0.0',
      description: 'Catálogo interactivo de endpoints para el sistema de clonación del SRI',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Servidor Local de Desarrollo',
      },
    ],
  },
  apis: [
    path.join(__dirname, './routes/*.ts'),
    path.join(__dirname, './routes/*.js'),
    path.join(__dirname, './index.ts'),
  ],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    message: '🟢 Servidor SRI Clone funcionando correctamente',
    timestamp: new Date().toISOString(),
  });
});

/* RUTAS PRINCIPALES */
app.use('/api/auth', authRoutes);
app.use('/api/contribuyentes', requireAuth, contribuyenteRoutes);
app.use('/api/admin', requireAuth, adminRoutes);

/* RUTAS TRANSACCIONALES */
app.use('/api/declaraciones', requireAuth, declaracionRoutes);
app.use('/api/anexos', requireAuth, anexoRoutes);

/* RUTA ATS MASIVO */
app.use('/api/ats', requireAuth, atsRoutes);

/* RUTA CONTABILIDAD */
app.use('/api/contabilidad', requireAuth, contabilidadRoutes);

app.listen(PORT, () => {
  console.log(`
  ┌──────────────────────────────────────────────────────────────┐
  │   🟢 SRI Clone Backend ACTIVO                               │
  │                                                              │
  │   🔗 Servidor Base   : http://localhost:${PORT}              │
  │   🛡️ Auth API        : /api/auth                             │
  │   👥 Contribuyentes  : /api/contribuyentes                   │
  │   📄 Declaraciones   : /api/declaraciones                    │
  │   📎 Anexos          : /api/anexos                           │
  │   📦 ATS Masivo      : /api/ats                              │
  │   📘 Contabilidad    : /api/contabilidad                     │
  │   🩺 Health Check    : /api/health                           │
  │                                                              │
  │   ⚙️ Entorno         : ${process.env.NODE_ENV || 'development'}                       │
  └──────────────────────────────────────────────────────────────┘
  `);
});

export default app;
