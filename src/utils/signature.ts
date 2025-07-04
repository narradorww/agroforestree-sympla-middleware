import crypto from 'crypto';

export class SignatureValidator {
  private readonly secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  /**
   * Valida assinatura HMAC do webhook da Sympla
   * Implementa comparação de tempo constante para prevenir timing attacks
   */
  validateSignature(payload: Buffer, signature: string): boolean {
    if (!signature) {
      console.warn('🚨 Webhook recebido sem assinatura');
      return false;
    }
  
    console.log('🔐 Secret usado:', this.secret);
    console.log('📄 Payload para validação:', payload.toString());
    
    // Normaliza assinatura recebida (remove prefixo se houver)
    const receivedSignature = signature.replace(/^sha256=/i, '').trim();
    console.log('🔐 Signature recebida (sem prefixo):', receivedSignature);
  
    // Calcula HMAC esperado
    const hmac = crypto.createHmac('sha256', this.secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    console.log('🔐 Signature esperada:', expectedSignature);
  
    const receivedBuffer = Buffer.from(receivedSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  
    if (receivedBuffer.length !== expectedBuffer.length) {
      console.warn('🚨 Assinatura recebida tem tamanho diferente da esperada');
      console.warn('🚨 Tamanho recebido:', receivedBuffer.length, 'Tamanho esperado:', expectedBuffer.length);
      return false;
    }
  
    try {
      const isValid = crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
      console.log('✅ Assinatura válida:', isValid);
      return isValid;
    } catch (error) {
      console.error('❌ Erro na validação de assinatura:', error);
      return false;
    }
  }
  

  /**
   * Valida timestamp para prevenir replay attacks
   */
  validateTimestamp(timestamp: string, toleranceMinutes: number = 5): boolean {
    const webhookTime = new Date(timestamp).getTime();
    const currentTime = Date.now();
    const toleranceMs = toleranceMinutes * 60 * 1000;

    return Math.abs(currentTime - webhookTime) <= toleranceMs;
  }
}