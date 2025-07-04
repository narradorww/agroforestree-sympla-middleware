import { Request, Response } from 'express';
import { WebhookHandler } from '../handlers/webhookHandler';
import { AgroforestreeClient } from '../services/agroforestreeClient';
import { SymplaWebhookPayload, SymplaOrderData } from '../types';

// Mock das dependências
jest.mock('../services/agroforestreeClient');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid-123')
}));

describe('WebhookHandler', () => {
  let webhookHandler: WebhookHandler;
  let mockAgroforestreeClient: jest.Mocked<AgroforestreeClient>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  const webhookSecret = 'test-webhook-secret';

  beforeEach(() => {
    mockAgroforestreeClient = {
      createDonation: jest.fn(),
      getDonationStatus: jest.fn()
    } as any;

    webhookHandler = new WebhookHandler(webhookSecret, mockAgroforestreeClient);

    mockRequest = {
      headers: {},
      body: Buffer.from('{}')
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processWebhook', () => {
    const validPayload: SymplaWebhookPayload = {
      event: 'order.approved',
      data: {
        order_identifier: 'order-123',
        event_id: 'event-456',
        event_name: 'Test Event',
        total_order_amount: 100.00,
        buyer_first_name: 'João',
        buyer_last_name: 'Silva',
        buyer_email: 'joao@example.com',
        order_status: 'approved'
      }
    };

    it('should reject webhook without signature', async () => {
      mockRequest.headers = {};
      mockRequest.body = Buffer.from(JSON.stringify(validPayload));

      await webhookHandler.processWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
    });

    it('should reject webhook with invalid signature', async () => {
      mockRequest.headers = { 'x-sympla-signature': 'invalid-signature' };
      mockRequest.body = Buffer.from(JSON.stringify(validPayload));

      await webhookHandler.processWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
    });

    it('should process valid webhook with correct signature', async () => {
      // Mock signature validation to pass
      const webhookHandlerWithMockedValidator = new WebhookHandler(webhookSecret, mockAgroforestreeClient);
      
      // Spy on signature validation
      const mockValidateSignature = jest.spyOn(
        (webhookHandlerWithMockedValidator as any).signatureValidator,
        'validateSignature'
      ).mockReturnValue(true);

      mockRequest.headers = { 'x-sympla-signature': 'valid-signature' };
      mockRequest.body = Buffer.from(JSON.stringify(validPayload));

      mockAgroforestreeClient.createDonation.mockResolvedValue({
        donationId: 'donation-123',
        status: 'PENDING_PLANTING',
        createdAt: '2024-01-01T00:00:00Z'
      });

      await webhookHandlerWithMockedValidator.processWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockValidateSignature).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Webhook processado com sucesso',
        timestamp: expect.any(String)
      });
    });

    it('should only process order.approved events', async () => {
      const orderCreatedPayload: SymplaWebhookPayload = {
        event: 'order.created',
        data: validPayload.data
      };

      // Mock signature validation to pass
      const webhookHandlerWithMockedValidator = new WebhookHandler(webhookSecret, mockAgroforestreeClient);
      jest.spyOn(
        (webhookHandlerWithMockedValidator as any).signatureValidator,
        'validateSignature'
      ).mockReturnValue(true);

      mockRequest.headers = { 'x-sympla-signature': 'valid-signature' };
      mockRequest.body = Buffer.from(JSON.stringify(orderCreatedPayload));

      await webhookHandlerWithMockedValidator.processWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockAgroforestreeClient.createDonation).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should handle malformed JSON gracefully', async () => {
      // Mock signature validation to pass
      const webhookHandlerWithMockedValidator = new WebhookHandler(webhookSecret, mockAgroforestreeClient);
      jest.spyOn(
        (webhookHandlerWithMockedValidator as any).signatureValidator,
        'validateSignature'
      ).mockReturnValue(true);

      mockRequest.headers = { 'x-sympla-signature': 'valid-signature' };
      mockRequest.body = Buffer.from('invalid-json');

      await webhookHandlerWithMockedValidator.processWebhook(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('handleOrderApproved', () => {
    it('should create donation attempt and call Agroforestree API', async () => {
      const orderData: SymplaOrderData = {
        order_identifier: 'order-123',
        event_id: 'event-456',
        event_name: 'Test Event',
        total_order_amount: 100.00,
        buyer_first_name: 'João',
        buyer_last_name: 'Silva',
        buyer_email: 'joao@example.com',
        order_status: 'approved'
      };

      mockAgroforestreeClient.createDonation.mockResolvedValue({
        donationId: 'donation-123',
        status: 'PENDING_PLANTING',
        createdAt: '2024-01-01T00:00:00Z'
      });

      // Call private method through public interface
      await (webhookHandler as any).handleOrderApproved(orderData);

      expect(mockAgroforestreeClient.createDonation).toHaveBeenCalledWith({
        sourcePlatform: 'Sympla',
        sourceOrderId: 'order-123',
        sourceEventId: 'event-456',
        donorName: 'João Silva',
        donorEmail: 'joao@example.com',
        donationValue: 5.00,
        campaignId: 'sympla-geral-2024'
      });
    });

    it('should handle Agroforestree API error', async () => {
      const orderData: SymplaOrderData = {
        order_identifier: 'order-123',
        event_id: 'event-456',
        event_name: 'Test Event',
        total_order_amount: 100.00,
        buyer_first_name: 'João',
        buyer_last_name: 'Silva',
        buyer_email: 'joao@example.com',
        order_status: 'approved'
      };

      mockAgroforestreeClient.createDonation.mockRejectedValue(new Error('API Error'));

      // Should not throw error, should handle gracefully
      await expect((webhookHandler as any).handleOrderApproved(orderData)).resolves.not.toThrow();

      expect(mockAgroforestreeClient.createDonation).toHaveBeenCalled();
    });
  });

  describe('getDonations', () => {
    it('should return empty array initially', () => {
      const donations = webhookHandler.getDonations();
      expect(donations).toEqual([]);
    });

    it('should return donation attempts after processing orders', async () => {
      const orderData: SymplaOrderData = {
        order_identifier: 'order-123',
        event_id: 'event-456',
        event_name: 'Test Event',
        total_order_amount: 100.00,
        buyer_first_name: 'João',
        buyer_last_name: 'Silva',
        buyer_email: 'joao@example.com',
        order_status: 'approved'
      };

      mockAgroforestreeClient.createDonation.mockResolvedValue({
        donationId: 'donation-123',
        status: 'PENDING_PLANTING',
        createdAt: '2024-01-01T00:00:00Z'
      });

      await (webhookHandler as any).handleOrderApproved(orderData);

      const donations = webhookHandler.getDonations();
      expect(donations).toHaveLength(1);
      expect(donations[0].sympla_order_id).toBe('order-123');
      expect(donations[0].status).toBe('COMPLETED');
    });
  });

  describe('error scenarios', () => {
    it('should handle donation creation failure', async () => {
      const orderData: SymplaOrderData = {
        order_identifier: 'order-123',
        event_id: 'event-456',
        event_name: 'Test Event',
        total_order_amount: 100.00,
        buyer_first_name: 'João',
        buyer_last_name: 'Silva',
        buyer_email: 'joao@example.com',
        order_status: 'approved'
      };

      mockAgroforestreeClient.createDonation.mockRejectedValue(new Error('Network error'));

      await (webhookHandler as any).handleOrderApproved(orderData);

      const donations = webhookHandler.getDonations();
      expect(donations).toHaveLength(1);
      expect(donations[0].status).toBe('DECLINED');
    });
  });
});