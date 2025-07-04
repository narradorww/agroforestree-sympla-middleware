import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import { WebhookHandler } from './handlers/webhookHandler';
import { AgroforestreeClient } from './services/agroforestreeClient';
import { EnvironmentConfig } from './types';

// Carrega variáveis de ambiente
dotenv.config();

// Configuração do ambiente
const config: EnvironmentConfig = {
  PORT: parseInt(process.env.PORT || '3001'),
  SYMPLA_WEBHOOK_SECRET: process.env.SYMPLA_WEBHOOK_SECRET || 'test-webhook-secret-123',
  AGROFORESTREE_API_URL: process.env.AGROFORESTREE_API_URL || 'https://api.agroforestree.com',
  AGROFORESTREE_API_KEY: process.env.AGROFORESTREE_API_KEY || 'sua-api-key',
  NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development'
};

// Inicializa serviços
const agroforestreeClient = new AgroforestreeClient(
  config.AGROFORESTREE_API_URL,
  config.AGROFORESTREE_API_KEY
);
const webhookHandler = new WebhookHandler(
  config.SYMPLA_WEBHOOK_SECRET,
  agroforestreeClient
);

// Inicializa Express
const app = express();

// CORS para permitir comunicação com frontend e Swagger
app.use(cors({
  origin: function (origin, callback) {
    // Permite requisições sem origin (Postman, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Lista de origens permitidas
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://sympla-simulator.vercel.app', // URL específica da Vercel
      process.env.FRONTEND_URL,
      process.env.RENDER_EXTERNAL_URL, // URL automática do Render
    ].filter(Boolean); // Remove valores undefined/null
    
    // Permite qualquer subdomínio do Render ou Vercel
    if (origin.includes('.onrender.com') || 
        origin.includes('.vercel.app') || 
        allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(null, true); // Para desenvolvimento, permitir tudo
  },
  credentials: true
}));

// 🔒 Express JSON - ignorar rota do webhook (precisa ser raw)
app.use((req, res, next) => {
  if (req.originalUrl === '/webhooks/sympla') return next();
  express.json()(req, res, next);
});

// 🔐 Express RAW para capturar body original do webhook Sympla
app.use('/webhooks/sympla', express.raw({ type: 'application/json' }));

// 📚 Documentação Swagger
const swaggerDocument = YAML.load(path.join(__dirname, '../docs/swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  explorer: true,
  customSiteTitle: 'Agroforestree-Sympla Integration API',
  customfavIcon: '/favicon.ico',
  customCss: `
    .swagger-ui .topbar { background-color: #2E8B57; }
    .swagger-ui .topbar .download-url-wrapper .select-label { color: white; }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true
  }
}));

// 🔁 Endpoint Webhook Sympla
app.post('/webhooks/sympla', (req, res) => webhookHandler.processWebhook(req, res));

// 🔎 Healthcheck
app.get('/health', (req, res) => {
  res.json({ 
    status: '🌱 Middleware Agroforestree ativo',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV
  });
});

// 📊 Consulta das doações armazenadas
app.get('/api/donations', (req, res) => {
  const donationAttempts = webhookHandler.getDonations();
  
  // Mapeia os dados para o formato esperado pelo frontend
  const donations = donationAttempts.map(attempt => ({
    id: attempt.id,
    donorName: attempt.donor_name || `Doador ${attempt.sympla_order_id}`,
    status: attempt.status,
    value: 5.00, // Valor fixo da PoC
    createdAt: attempt.created_at.toISOString(),
    eventName: attempt.event_name || `Evento ${attempt.sympla_event_id}`,
    orderId: attempt.sympla_order_id
  }));
  
  res.json({
    donations,
    total: donations.length,
    timestamp: new Date().toISOString()
  });
});

// Simula envio de webhook para o próprio middleware
app.post('/simulate/sympla-webhook', express.json(), async (req, res) => {
  const {
    order_identifier = 'XYZ123',
    event_id = 'EVT456',
    event_name = 'Festival Sustentável 2025',
    buyer_first_name = 'João',
    buyer_last_name = 'Silva',
    buyer_email = 'joao@email.com',
    total_order_amount = 50.00
  } = req.body;

  const payload = {
    event: 'order.approved',
    data: {
      order_identifier,
      event_id,
      event_name,
      order_status: 'approved',
      buyer_first_name,
      buyer_last_name,
      buyer_email,
      total_order_amount,
      participants_full_name_comma_separated: `${buyer_first_name} ${buyer_last_name}`,
      participants_email_comma_separated: buyer_email
    }
  };

  const rawPayload = Buffer.from(JSON.stringify(payload));
  const hmac = crypto.createHmac('sha256', config.SYMPLA_WEBHOOK_SECRET);
  hmac.update(rawPayload);
  const signature = `sha256=${hmac.digest('hex')}`;

  try {
    const response = await axios.post(`http://localhost:${config.PORT}/webhooks/sympla`, rawPayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-sympla-signature': signature
      }
    });

    res.json({
      status: '✅ Simulação enviada',
      webhookResponse: response.data
    });
  } catch (error: any) {
    res.status(500).json({
      status: '❌ Erro ao enviar webhook simulado',
      error: error?.response?.data || error.message
    });
  }
});

// 🚀 Inicia servidor
app.listen(config.PORT, () => {
  console.log(`
🌱 ================================
   Middleware Agroforestree 
🌱 ================================
📡 Servidor rodando na porta ${config.PORT}
🔧 Ambiente: ${config.NODE_ENV}
🔗 Health check: http://localhost:${config.PORT}/health
📊 Dashboard API: http://localhost:${config.PORT}/api/donations
🪝 Webhook endpoint: http://localhost:${config.PORT}/webhooks/sympla
📚 Documentação API: http://localhost:${config.PORT}/api-docs
================================
  `);
});

// 🧹 Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Encerrando servidor...');
  process.exit(0);
});
