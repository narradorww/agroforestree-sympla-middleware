import crypto from 'crypto';
import { SignatureValidator } from '../utils/signature';

describe('SignatureValidator', () => {
  const testSecret = 'test-secret-key';
  let validator: SignatureValidator;

  beforeEach(() => {
    validator = new SignatureValidator(testSecret);
  });

  describe('validateSignature', () => {
    it('should validate correct HMAC signature', () => {
      const payload = Buffer.from('{"test": "data"}');
      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(payload);
      const validSignature = `sha256=${hmac.digest('hex')}`;

      const result = validator.validateSignature(payload, validSignature);
      expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = Buffer.from('{"test": "data"}');
      const invalidSignature = 'sha256=invalid-signature';

      const result = validator.validateSignature(payload, invalidSignature);
      expect(result).toBe(false);
    });

    it('should reject empty signature', () => {
      const payload = Buffer.from('{"test": "data"}');
      
      const result = validator.validateSignature(payload, '');
      expect(result).toBe(false);
    });

    it('should reject null signature', () => {
      const payload = Buffer.from('{"test": "data"}');
      
      const result = validator.validateSignature(payload, null as any);
      expect(result).toBe(false);
    });

    it('should reject signature with wrong payload', () => {
      const originalPayload = Buffer.from('{"test": "data"}');
      const tamperedPayload = Buffer.from('{"test": "tampered"}');
      
      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(originalPayload);
      const signature = `sha256=${hmac.digest('hex')}`;

      const result = validator.validateSignature(tamperedPayload, signature);
      expect(result).toBe(false);
    });

    it('should handle malformed signature gracefully', () => {
      const payload = Buffer.from('{"test": "data"}');
      const malformedSignature = 'not-a-valid-signature-format';

      const result = validator.validateSignature(payload, malformedSignature);
      expect(result).toBe(false);
    });
  });

  describe('validateTimestamp', () => {
    it('should validate recent timestamp', () => {
      const recentTimestamp = new Date().toISOString();
      
      const result = validator.validateTimestamp(recentTimestamp);
      expect(result).toBe(true);
    });

    it('should reject old timestamp beyond tolerance', () => {
      const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutos atrás
      
      const result = validator.validateTimestamp(oldTimestamp, 5); // tolerância de 5 minutos
      expect(result).toBe(false);
    });

    it('should validate timestamp within custom tolerance', () => {
      const timestamp = new Date(Date.now() - 8 * 60 * 1000).toISOString(); // 8 minutos atrás
      
      const result = validator.validateTimestamp(timestamp, 10); // tolerância de 10 minutos
      expect(result).toBe(true);
    });

    it('should reject future timestamp beyond tolerance', () => {
      const futureTimestamp = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutos no futuro
      
      const result = validator.validateTimestamp(futureTimestamp, 5); // tolerância de 5 minutos
      expect(result).toBe(false);
    });

    it('should handle invalid timestamp format', () => {
      const invalidTimestamp = 'not-a-timestamp';
      
      const result = validator.validateTimestamp(invalidTimestamp);
      expect(result).toBe(false);
    });
  });
});