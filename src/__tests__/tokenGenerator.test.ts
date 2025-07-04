import { TokenGenerator, DonationToken } from '../utils/tokenGenerator';

describe('TokenGenerator', () => {
  const testSecret = 'test-secret-key';
  let tokenGenerator: TokenGenerator;

  beforeEach(() => {
    tokenGenerator = new TokenGenerator(testSecret);
  });

  describe('generateDonationToken', () => {
    it('should generate valid token with correct structure', () => {
      const orderId = 'order-123';
      const eventId = 'event-456';

      const token = tokenGenerator.generateDonationToken(orderId, eventId);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(2);
    });

    it('should generate different tokens for different inputs', () => {
      const token1 = tokenGenerator.generateDonationToken('order-1', 'event-1');
      const token2 = tokenGenerator.generateDonationToken('order-2', 'event-2');
      
      expect(token1).not.toBe(token2);
    });

    it('should generate same token for same inputs (within same timestamp)', () => {
      const orderId = 'order-123';
      const eventId = 'event-456';

      // Mock Date.now para garantir mesmo timestamp
      const fixedTime = 1234567890000;
      jest.spyOn(Date, 'now').mockReturnValue(fixedTime);

      const token1 = tokenGenerator.generateDonationToken(orderId, eventId);
      const token2 = tokenGenerator.generateDonationToken(orderId, eventId);
      
      expect(token1).toBe(token2);

      jest.restoreAllMocks();
    });
  });

  describe('validateToken', () => {
    it('should validate valid token', () => {
      const orderId = 'order-123';
      const eventId = 'event-456';

      const token = tokenGenerator.generateDonationToken(orderId, eventId);
      const result = tokenGenerator.validateToken(token);
      
      expect(result).toBeTruthy();
      expect(result?.orderId).toBe(orderId);
      expect(result?.eventId).toBe(eventId);
    });

    it('should reject token with invalid signature', () => {
      const orderId = 'order-123';
      const eventId = 'event-456';

      const token = tokenGenerator.generateDonationToken(orderId, eventId);
      const [payload] = token.split('.');
      const tamperedToken = `${payload}.invalid-signature`;
      
      const result = tokenGenerator.validateToken(tamperedToken);
      expect(result).toBeNull();
    });

    it('should reject malformed token', () => {
      const malformedToken = 'not.a.valid.token.format';
      
      const result = tokenGenerator.validateToken(malformedToken);
      expect(result).toBeNull();
    });

    it('should reject token with invalid base64', () => {
      const invalidToken = 'invalid-base64.valid-signature';
      
      const result = tokenGenerator.validateToken(invalidToken);
      expect(result).toBeNull();
    });

    it('should reject expired token', () => {
      const orderId = 'order-123';
      const eventId = 'event-456';

      // Mock Date.now para criar token no passado
      const pastTime = Date.now() - (25 * 60 * 60 * 1000); // 25 horas atrás
      jest.spyOn(Date, 'now').mockReturnValue(pastTime);

      const token = tokenGenerator.generateDonationToken(orderId, eventId);
      
      // Restaura o tempo atual
      jest.restoreAllMocks();
      
      const result = tokenGenerator.validateToken(token);
      expect(result).toBeNull();
    });

    it('should validate token within expiration time', () => {
      const orderId = 'order-123';
      const eventId = 'event-456';

      // Mock Date.now para criar token recente
      const recentTime = Date.now() - (1 * 60 * 60 * 1000); // 1 hora atrás
      jest.spyOn(Date, 'now').mockReturnValue(recentTime);

      const token = tokenGenerator.generateDonationToken(orderId, eventId);
      
      // Restaura o tempo atual
      jest.restoreAllMocks();
      
      const result = tokenGenerator.validateToken(token);
      expect(result).toBeTruthy();
      expect(result?.orderId).toBe(orderId);
      expect(result?.eventId).toBe(eventId);
    });

    it('should handle token with different secret', () => {
      const orderId = 'order-123';
      const eventId = 'event-456';

      const token = tokenGenerator.generateDonationToken(orderId, eventId);
      
      // Cria novo generator com secret diferente
      const differentGenerator = new TokenGenerator('different-secret');
      const result = differentGenerator.validateToken(token);
      
      expect(result).toBeNull();
    });
  });

  describe('token payload structure', () => {
    it('should contain expected fields in payload', () => {
      const orderId = 'order-123';
      const eventId = 'event-456';

      const token = tokenGenerator.generateDonationToken(orderId, eventId);
      const [encodedPayload] = token.split('.');
      
      const payload: DonationToken = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString()
      );

      expect(payload.orderId).toBe(orderId);
      expect(payload.eventId).toBe(eventId);
      expect(payload.timestamp).toBeDefined();
      expect(payload.exp).toBeDefined();
      expect(payload.exp).toBeGreaterThan(payload.timestamp);
    });
  });
});