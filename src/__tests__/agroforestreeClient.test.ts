import axios from 'axios';
import { AgroforestreeClient } from '../services/agroforestreeClient';
import { AgroforestreeApiRequest, AgroforestreeApiResponse } from '../types';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AgroforestreeClient', () => {
  const testApiUrl = 'https://api.test.com';
  const testApiKey = 'test-api-key';
  let client: AgroforestreeClient;
  let mockAxiosInstance: jest.Mocked<any>;

  beforeEach(() => {
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn()
        }
      }
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    client = new AgroforestreeClient(testApiUrl, testApiKey);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create axios instance with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: testApiUrl,
        headers: {
          'Authorization': `Bearer ${testApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
    });

    it('should setup request interceptor', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    });
  });

  describe('createDonation', () => {
    const mockDonationRequest: AgroforestreeApiRequest = {
      sourcePlatform: 'Sympla',
      sourceOrderId: 'order-123',
      sourceEventId: 'event-456',
      donorName: 'João Silva',
      donorEmail: 'joao@example.com',
      donationValue: 5.00,
      campaignId: 'campaign-789'
    };

    const mockDonationResponse: AgroforestreeApiResponse = {
      donationId: 'donation-123',
      status: 'PENDING_PLANTING',
      createdAt: '2024-01-01T00:00:00Z',
      certificateUrl: 'https://certificate.url'
    };

    it('should create donation successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: mockDonationResponse });

      const result = await client.createDonation(mockDonationRequest);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/donations', mockDonationRequest);
      expect(result).toEqual(mockDonationResponse);
    });

    it('should handle API error gracefully', async () => {
      const errorMessage = 'Network Error';
      mockAxiosInstance.post.mockRejectedValue(new Error(errorMessage));

      await expect(client.createDonation(mockDonationRequest)).rejects.toThrow(
        `Falha na criação de doação: Error: ${errorMessage}`
      );
    });

    it('should handle HTTP error status', async () => {
      const httpError = {
        response: {
          status: 400,
          data: { message: 'Bad Request' }
        }
      };
      mockAxiosInstance.post.mockRejectedValue(httpError);

      await expect(client.createDonation(mockDonationRequest)).rejects.toThrow(
        'Falha na criação de doação:'
      );
    });
  });

  describe('getDonationStatus', () => {
    const donationId = 'donation-123';
    const mockStatusResponse: AgroforestreeApiResponse = {
      donationId: 'donation-123',
      status: 'PLANTED',
      createdAt: '2024-01-01T00:00:00Z',
      certificateUrl: 'https://certificate.url'
    };

    it('should get donation status successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockStatusResponse });

      const result = await client.getDonationStatus(donationId);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/donations/${donationId}`);
      expect(result).toEqual(mockStatusResponse);
    });

    it('should handle API error when getting status', async () => {
      const errorMessage = 'Not Found';
      mockAxiosInstance.get.mockRejectedValue(new Error(errorMessage));

      await expect(client.getDonationStatus(donationId)).rejects.toThrow(errorMessage);
    });

    it('should handle 404 error for non-existent donation', async () => {
      const notFoundError = {
        response: {
          status: 404,
          data: { message: 'Donation not found' }
        }
      };
      mockAxiosInstance.get.mockRejectedValue(notFoundError);

      await expect(client.getDonationStatus(donationId)).rejects.toEqual(notFoundError);
    });
  });

  describe('error handling', () => {
    it('should handle network timeout', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded'
      };
      mockAxiosInstance.post.mockRejectedValue(timeoutError);

      const mockRequest: AgroforestreeApiRequest = {
        sourcePlatform: 'Sympla',
        sourceOrderId: 'order-123',
        sourceEventId: 'event-456',
        donorName: 'João Silva',
        donorEmail: 'joao@example.com',
        donationValue: 5.00,
        campaignId: 'campaign-789'
      };

      await expect(client.createDonation(mockRequest)).rejects.toThrow(
        'Falha na criação de doação:'
      );
    });

    it('should handle server error (500)', async () => {
      const serverError = {
        response: {
          status: 500,
          data: { message: 'Internal Server Error' }
        }
      };
      mockAxiosInstance.post.mockRejectedValue(serverError);

      const mockRequest: AgroforestreeApiRequest = {
        sourcePlatform: 'Sympla',
        sourceOrderId: 'order-123',
        sourceEventId: 'event-456',
        donorName: 'João Silva',
        donorEmail: 'joao@example.com',
        donationValue: 5.00,
        campaignId: 'campaign-789'
      };

      await expect(client.createDonation(mockRequest)).rejects.toThrow(
        'Falha na criação de doação:'
      );
    });
  });
});