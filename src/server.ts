import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import QRCode from 'qrcode';
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

// 🧾 Middleware para autenticação API Key
const authenticateApiKey = (req: any, res: any, next: any) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY || 'agroforestree-api-key-demo';
  
  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({ error: 'API Key inválida ou ausente' });
  }
  
  next();
};

// 🌱 === FLUXO DO USUÁRIO FINAL === 

// Página de consentimento para doação
app.get('/donation/initiate', (req, res) => {
  const token = req.query.token as string;
  
  if (!token) {
    return res.status(400).json({ error: 'Token obrigatório' });
  }

  // TODO: Validar JWT token
  // Por enquanto, simula validação básica
  if (!token.startsWith('eyJ')) {
    return res.status(400).json({ error: 'Token inválido' });
  }

  // Página HTML simples para consentimento
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Plante uma Árvore - Agroforestree</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f0f8f0; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; color: #2E8B57; margin-bottom: 30px; }
        .form { margin: 20px 0; }
        .checkbox { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 5px; }
        .buttons { display: flex; gap: 10px; margin-top: 20px; }
        .btn { padding: 12px 24px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
        .btn-primary { background: #2E8B57; color: white; }
        .btn-secondary { background: #ccc; color: #333; }
        .impact { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌱 Obrigado por apoiar eventos sustentáveis!</h1>
            <p>Seu ingresso foi confirmado com sucesso.</p>
        </div>
        
        <div class="impact">
            <h3>🌍 Seu Impacto Ambiental:</h3>
            <ul>
                <li><strong>1 árvore</strong> plantada em sistema agroflorestal</li>
                <li><strong>165kg de CO₂</strong> compensado em 20 anos</li>
                <li><strong>1 agricultor familiar</strong> apoiado</li>
                <li><strong>Biodiversidade</strong> regenerada</li>
            </ul>
        </div>

        <form action="/donation/execute" method="POST" class="form">
            <input type="hidden" name="token" value="${token}">
            
            <div class="checkbox">
                <label>
                    <input type="checkbox" name="consent" value="on" required>
                    <strong>Autorizo o plantio de uma árvore em meu nome</strong>
                    <br><small>De acordo com a LGPD, seus dados serão usados exclusivamente para o plantio e emissão do certificado.</small>
                </label>
            </div>
            
            <div class="buttons">
                <button type="submit" class="btn btn-primary">🌳 Sim, plantar minha árvore!</button>
                <button type="button" class="btn btn-secondary" onclick="window.close()">Não, obrigado</button>
            </div>
        </form>
    </div>
</body>
</html>`;

  res.send(html);
});

// Processar consentimento e executar doação
app.post('/donation/execute', express.urlencoded({ extended: true }), async (req, res) => {
  const { token, consent } = req.body;
  
  if (!token || consent !== 'on') {
    return res.status(400).json({ error: 'Consentimento obrigatório para prosseguir' });
  }

  try {
    // TODO: Validar JWT e buscar dados da tentativa de doação
    // Por enquanto, simula doação bem-sucedida
    const donationId = `AGF-USER-${Date.now()}`;
    
    console.log(`✅ Doação com consentimento criada: ${donationId}`);
    console.log(`🔐 Token usado: ${token}`);
    
    // Redireciona para página de sucesso
    res.redirect(`/donation/success?donationId=${donationId}`);
  } catch (error) {
    console.error('❌ Erro ao processar doação com consentimento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Página de sucesso da doação
app.get('/donation/success', (req, res) => {
  const donationId = req.query.donationId as string;
  
  if (!donationId) {
    return res.status(400).json({ error: 'ID da doação obrigatório' });
  }

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Árvore Plantada! - Agroforestree</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f0f8f0; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
        .success { color: #2E8B57; margin-bottom: 30px; }
        .certificate { background: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .btn { display: inline-block; padding: 12px 24px; background: #2E8B57; color: white; text-decoration: none; border-radius: 5px; margin: 10px; }
        .social { margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="success">
            <h1>🌳 Parabéns! Sua árvore será plantada!</h1>
            <p>Doação ID: <strong>${donationId}</strong></p>
        </div>
        
        <div class="certificate">
            <h3>📜 Seu Certificado</h3>
            <p>Em breve você receberá por email o certificado com localização e detalhes do plantio.</p>
            <a href="#" class="btn">📥 Baixar Certificado (em breve)</a>
        </div>
        
        <div class="social">
            <h3>📱 Compartilhe seu impacto!</h3>
            <a href="#" class="btn">📘 Facebook</a>
            <a href="#" class="btn">🐦 Twitter</a>
            <a href="#" class="btn">📸 Instagram</a>
        </div>
        
        <p><small>Obrigado por tornar os eventos mais sustentáveis! 🌱</small></p>
    </div>
</body>
</html>`;

  res.send(html);
});

// 🎯 === DASHBOARD DO ORGANIZADOR ===

// Métricas de impacto por evento
app.get('/events/:eventId/impact-summary', authenticateApiKey, (req, res) => {
  const { eventId } = req.params;
  
  // Busca doações relacionadas ao evento
  const eventDonations = webhookHandler.getDonations().filter(
    donation => donation.sympla_event_id === eventId
  );
  
  const totalDonations = eventDonations.length;
  const completedDonations = eventDonations.filter(d => d.status === 'COMPLETED').length;
  
  // Simula dados do evento (em produção viria da API da Sympla)
  const mockTotalTickets = Math.max(totalDonations * 4, 100); // Simula que 25% dos compradores doam
  const engagementRate = totalDonations > 0 ? ((totalDonations / mockTotalTickets) * 100).toFixed(1) : '0.0';
  
  const summary = {
    eventId,
    eventName: eventDonations[0]?.event_name || `Evento ${eventId}`,
    summary: {
      totalTickets: mockTotalTickets,
      totalDonations,
      engagementRate: `${engagementRate}%`,
      treesPlanted: completedDonations,
      co2Compensated: `${(completedDonations * 0.165).toFixed(2)} toneladas`,
      farmersSupported: completedDonations,
      totalDonationValue: `R$ ${(totalDonations * 5).toFixed(2)}`
    },
    period: {
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Últimas 24h
      endDate: new Date().toISOString()
    }
  };
  
  res.json(summary);
});

// Gerar QR Code para evento
app.get('/events/:eventId/qrcode', authenticateApiKey, async (req, res) => {
  const { eventId } = req.params;
  const size = parseInt(req.query.size as string) || 400;
  const format = req.query.format as string || 'svg';
  
  // URL que o QR Code vai apontar
  const donationToken = `eyJhbGciOiJIUzI1NiIs_EVENTO_${eventId}_TOKEN`;
  const donationUrl = `${req.protocol}://${req.get('host')}/donation/initiate?token=${donationToken}`;
  
  try {
    if (format === 'svg') {
      // Gerar QR Code como SVG
      const qrCodeSVG = await QRCode.toString(donationUrl, {
        type: 'svg',
        width: size,
        margin: 2,
        color: {
          dark: '#2E8B57',  // Verde Agroforestree
          light: '#FFFFFF'
        }
      });
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(qrCodeSVG);
    } else {
      // Gerar QR Code como PNG (Data URL)
      const qrCodeDataURL = await QRCode.toDataURL(donationUrl, {
        width: size,
        margin: 2,
        color: {
          dark: '#2E8B57',
          light: '#FFFFFF'
        }
      });
      
      // Converter Data URL para Buffer
      const base64Data = qrCodeDataURL.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      res.setHeader('Content-Type', 'image/png');
      res.send(buffer);
    }
  } catch (error) {
    console.error('❌ Erro ao gerar QR Code:', error);
    res.status(500).json({ error: 'Erro ao gerar QR Code' });
  }
});

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
    event: eventType = 'order.approved',
    data: requestData
  } = req.body;

  const {
    order_identifier = 'XYZ123',
    event_id = 'EVT456',
    event_name = 'Festival Sustentável 2025',
    buyer_first_name = 'João',
    buyer_last_name = 'Silva',
    buyer_email = 'joao@email.com',
    total_order_amount = 50.00,
    order_status = eventType === 'order.approved' ? 'approved' : 
                   eventType === 'order.cancelled' ? 'cancelled' :
                   eventType === 'order.refunded' ? 'refunded' : 'pending'
  } = requestData || {};

  const payload = {
    event: eventType,
    data: {
      order_identifier,
      event_id,
      event_name,
      order_status,
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
