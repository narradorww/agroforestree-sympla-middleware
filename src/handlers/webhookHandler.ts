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

      // 3. Processamento por tipo de evento
      switch (payload.event) {
        case 'order.approved':
          await this.handleOrderApproved(payload.data);
          break;
        case 'order.cancelled':
          await this.handleOrderCancelled(payload.data);
          break;
        case 'order.refunded':
          await this.handleOrderRefunded(payload.data);
          break;
        case 'order.created':
          console.log(`📝 Pedido criado: ${payload.data.order_identifier} (aguardando aprovação)`);
          break;
        default:
          console.log(`ℹ️ Evento não processado: ${payload.event}`);
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
   * Processa cancelamento de pedido
   */
  private async handleOrderCancelled(orderData: SymplaOrderData): Promise<void> {
    console.log(`❌ Pedido cancelado: ${orderData.order_identifier}`);

    // Busca tentativa de doação existente
    const existingAttempt = this.donationAttempts.get(orderData.order_identifier);
    
    if (existingAttempt) {
      // Atualiza status para cancelado
      existingAttempt.status = 'CANCELLED';
      existingAttempt.updated_at = new Date();
      this.donationAttempts.set(orderData.order_identifier, existingAttempt);
      
      console.log(`🚫 Doação cancelada para pedido ${orderData.order_identifier}`);
      
      // Em produção, aqui seria feita a chamada para a API da Agroforestree
      // para cancelar a doação se ainda estiver em processamento
      // await this.agroforestreeClient.cancelDonation(donationId);
      
    } else {
      console.log(`⚠️ Tentativa de cancelar pedido inexistente: ${orderData.order_identifier}`);
      
      // Cria registro de cancelamento mesmo se não existia antes
      const cancelledAttempt: DonationAttempt = {
        id: uuidv4(),
        sympla_order_id: orderData.order_identifier,
        sympla_event_id: orderData.event_id,
        status: 'CANCELLED',
        donation_token: '', // Não precisa de token para cancelamentos
        created_at: new Date(),
        updated_at: new Date(),
        donor_name: `${orderData.buyer_first_name} ${orderData.buyer_last_name}`,
        donor_email: orderData.buyer_email,
        event_name: orderData.event_name,
        order_amount: orderData.total_order_amount
      };
      
      this.donationAttempts.set(orderData.order_identifier, cancelledAttempt);
    }
  }

  /**
   * Processa reembolso de pedido
   */
  private async handleOrderRefunded(orderData: SymplaOrderData): Promise<void> {
    console.log(`💰 Pedido reembolsado: ${orderData.order_identifier}`);

    // Busca tentativa de doação existente
    const existingAttempt = this.donationAttempts.get(orderData.order_identifier);
    
    if (existingAttempt) {
      // Atualiza status para reembolsado
      existingAttempt.status = 'REFUNDED';
      existingAttempt.updated_at = new Date();
      this.donationAttempts.set(orderData.order_identifier, existingAttempt);
      
      console.log(`💸 Doação reembolsada para pedido ${orderData.order_identifier}`);
      
      // Em produção, aqui seria feita a chamada para a API da Agroforestree
      // para processar o reembolso da doação
      // await this.agroforestreeClient.refundDonation(donationId);
      
    } else {
      console.log(`⚠️ Tentativa de reembolsar pedido inexistente: ${orderData.order_identifier}`);
      
      // Cria registro de reembolso mesmo se não existia antes
      const refundedAttempt: DonationAttempt = {
        id: uuidv4(),
        sympla_order_id: orderData.order_identifier,
        sympla_event_id: orderData.event_id,
        status: 'REFUNDED',
        donation_token: `token_${Date.now()}`,
        created_at: new Date(),
        updated_at: new Date(),
        donor_name: `${orderData.buyer_first_name} ${orderData.buyer_last_name}`,
        donor_email: orderData.buyer_email,
        event_name: orderData.event_name,
        order_amount: orderData.total_order_amount
      };
      
      this.donationAttempts.set(orderData.order_identifier, refundedAttempt);
    }
  }

  /**
   * Retorna todas as doações para o dashboard
   */
  getDonations(): DonationAttempt[] {
    return Array.from(this.donationAttempts.values());
  }
}