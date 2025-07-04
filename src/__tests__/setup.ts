// Setup global para testes
import dotenv from 'dotenv';

// Carrega variáveis de ambiente para testes
dotenv.config({ path: '.env.test' });

// Mock console methods para reduzir ruído nos testes
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};