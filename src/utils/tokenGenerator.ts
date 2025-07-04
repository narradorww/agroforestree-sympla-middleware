import crypto from 'crypto';

export interface DonationToken {
  orderId: string;
  eventId: string;
  timestamp: number;
  exp: number; // Expiration time
}

export class TokenGenerator {
  private readonly secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  /**
   * Gera token seguro para doação (JWT simplificado)
   */
  generateDonationToken(orderId: string, eventId: string): string {
    const payload: DonationToken = {
      orderId,
      eventId,
      timestamp: Date.now(),
      exp: Date.now() + (24 * 60 * 60 * 1000) // 24 horas
    };

    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.signPayload(encodedPayload);
    
    return `${encodedPayload}.${signature}`;
  }

  /**
   * Valida e decodifica token de doação
   */
  validateToken(token: string): DonationToken | null {
    try {
      const [encodedPayload, signature] = token.split('.');
      
      // Valida assinatura
      const expectedSignature = this.signPayload(encodedPayload);
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return null;
      }

      // Decodifica payload
      const payload: DonationToken = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString()
      );

      // Verifica expiração
      if (Date.now() > payload.exp) {
        return null;
      }

      return payload;
    } catch (error) {
      console.error('❌ Erro ao validar token:', error);
      return null;
    }
  }

  private signPayload(payload: string): string {
    return crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('base64url');
  }
}