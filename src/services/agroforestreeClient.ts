import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { AgroforestreeApiRequest, AgroforestreeApiResponse } from '../types';

export class AgroforestreeClient {
  private readonly client: AxiosInstance;

  constructor(apiUrl: string, apiKey: string) {
    this.client = axios.create({
      baseURL: apiUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 segundos
    });

    // Interceptor para logs
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🌱 Chamando API Agroforestree: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  /**
   * Cria uma nova doação na API da Agroforestree
   */
  async createDonation(donationData: AgroforestreeApiRequest): Promise<AgroforestreeApiResponse> {
    try {
      // Para PoC: simula resposta da API da Agroforestree
      if (this.client.defaults.baseURL?.includes('api.agroforestree.com')) {
        console.log('🚧 Simulando API Agroforestree para PoC...');
        
        // Simula delay da API real
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const mockResponse: AgroforestreeApiResponse = {
          donationId: `AGF-${Date.now()}`,
          status: 'PENDING_PLANTING',
          createdAt: new Date().toISOString(),
          certificateUrl: `https://certificados.agroforestree.com/${Date.now()}.pdf`
        };
        
        console.log(`✅ Doação simulada criada: ${mockResponse.donationId}`);
        return mockResponse;
      }
      
      // Chamada real para API externa (quando configurada)
      const response: AxiosResponse<AgroforestreeApiResponse> = await this.client.post(
        '/donations',
        donationData
      );

      console.log(`✅ Doação criada com sucesso: ${response.data.donationId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao criar doação:', error);
      throw new Error(`Falha na criação de doação: ${error}`);
    }
  }

  /**
   * Consulta status de uma doação
   */
  async getDonationStatus(donationId: string): Promise<AgroforestreeApiResponse> {
    try {
      const response: AxiosResponse<AgroforestreeApiResponse> = await this.client.get(
        `/donations/${donationId}`
      );

      return response.data;
    } catch (error) {
      console.error(`❌ Erro ao consultar doação ${donationId}:`, error);
      throw error;
    }
  }
}