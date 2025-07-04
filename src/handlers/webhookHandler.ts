import { Request, Response } from 'express';
import { SymplaWebhookPayload, SymplaOrderData, DonationAttempt } from '../types';
import { SignatureValidator } from '../utils/signature';
import { TokenGenerator } from '../utils/tokenGenerator';
import { AgroforestreeClient } from '../services/agroforestreeClient';
import { v4 as uuidv4 } from 'uuid';

export class WebhookHandler {
  private readonly signatureValidator: SignatureValidator;
  private readonly tokenGenerator: TokenGenerator;
  private readonly agroforestreeClient: AgroforestreeClient;
  private readonly donationAttempts: Map<string, DonationAttempt> = new Map();

  constructor(
    webhookSecret: string,
    agroforestreeClient: AgroforestreeClient
  ) {
    this.signatureValidator = new SignatureValidator(webhookSecret);
    this.tokenGenerator = new TokenGenerator(webhookSecret);
    this.agroforestreeClient = agroforestreeClient;
  }

  /**
   * Processa webhook da Sympla
   */
  async processWebhook(req: Request, res: Response): Promise<void> {
    try {
      console.log('📨 Webhook recebido da Sympla');
      console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
      console.log('📄 Body length:', req.body.length);
      console.log('📄 Raw Body:', req.body.toString());

      // 1. Validação de assinatura
      const signature = req.headers['x-sympla-signature'] as string;
      console.log('🔐 Signature recebida:', signature);
      console.log('🔐 Origin:', req.headers.origin);
      
      if (!this.signatureValidator.validateSignature(req.body, signature)) {
        console.error('🚨 Assinatura inválida - rejeitando requisição');
        res.status(401).json({ 
          error: 'Invalid signature',
          received: signature,
          origin: req.headers.origin 
        });
        return;
      }

      // 2. Parse do payload
      const payload: SymplaWebhookPayload = JSON.parse(req.body.toString());
      console.log(`📋 Evento recebido: ${payload.event}`);

      // 3. Processamento apenas para pedidos aprovados
      if (payload.event === 'order.approved') {
        await this.handleOrderApproved(payload.data);
      }

      // 4. Resposta rápida para a Sympla
      res.status(200).json({ 
        status: 'success', 
        message: 'Webhook processado com sucesso',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erro no processamento do webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Processa pedido aprovado
   */
  private async handleOrderApproved(orderData: SymplaOrderData): Promise<void> {
    console.log(`🎉 Pedido aprovado: ${orderData.order_identifier}`);

    // Cria registro da tentativa de doação
    const donationAttempt: DonationAttempt = {
      id: uuidv4(),
      sympla_order_id: orderData.order_identifier,
      sympla_event_id: orderData.event_id,
      status: 'PENDING_USER_ACTION',
      donation_token: this.tokenGenerator.generateDonationToken(
        orderData.order_identifier,
        orderData.event_id
      ),
      created_at: new Date(),
      updated_at: new Date(),
      // Armazena dados do pedido Sympla
      donor_name: `${orderData.buyer_first_name} ${orderData.buyer_last_name}`,
      donor_email: orderData.buyer_email,
      event_name: orderData.event_name,
      order_amount: orderData.total_order_amount
    };

    // Armazena em memória (em produção seria banco de dados)
    this.donationAttempts.set(orderData.order_identifier, donationAttempt);

    // Para a PoC, simula consentimento imediato e cria doação
    await this.createDonationWithConsent(orderData, donationAttempt);
  }

  /**
   * Simula consentimento e cria doação (para PoC)
   */
  private async createDonationWithConsent(
    orderData: SymplaOrderData,
    donationAttempt: DonationAttempt
  ): Promise<void> {
    try {
      console.log(`🌱 Criando doação para pedido ${orderData.order_identifier}`);

      const donationRequest = {
        sourcePlatform: 'Sympla' as const,
        sourceOrderId: orderData.order_identifier,
        sourceEventId: orderData.event_id,
        donorName: `${orderData.buyer_first_name} ${orderData.buyer_last_name}`,
        donorEmail: orderData.buyer_email,
        donationValue: 5.00, // Valor fixo para PoC
        campaignId: 'sympla-geral-2024'
      };

      const donationResponse = await this.agroforestreeClient.createDonation(donationRequest);

      // Atualiza status
      donationAttempt.status = 'COMPLETED';
      donationAttempt.updated_at = new Date();
      this.donationAttempts.set(orderData.order_identifier, donationAttempt);

      console.log(`✅ Doação criada: ${donationResponse.donationId}`);

    } catch (error) {
      console.error('❌ Erro ao criar doação:', error);
      donationAttempt.status = 'DECLINED';
      donationAttempt.updated_at = new Date();
      this.donationAttempts.set(orderData.order_identifier, donationAttempt);
    }
  }

  /**
   * Retorna todas as doações para o dashboard
   */
  getDonations(): DonationAttempt[] {
    return Array.from(this.donationAttempts.values());
  }
}