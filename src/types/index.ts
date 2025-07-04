// Tipos do webhook da Sympla (baseado no relatório técnico)
export interface SymplaWebhookPayload {
  event: 'order.approved' | 'order.created' | 'order.cancelled' | 'order.refunded';
  data: SymplaOrderData;
  timestamp?: string;
}

export interface SymplaOrderData {
  order_identifier: string;
  event_id: string;
  event_name: string;
  total_order_amount: number;
  buyer_first_name: string;
  buyer_last_name: string;
  buyer_email: string;
  order_status: 'approved' | 'pending' | 'declined';
  participants_full_name_comma_separated?: string;
  participants_email_comma_separated?: string;
}

// Tipos da API Agroforestree
export interface AgroforestreeApiRequest {
  sourcePlatform: 'Sympla';
  sourceOrderId: string;
  sourceEventId: string;
  donorName: string;
  donorEmail: string;
  donationValue: number;
  campaignId: string;
}

export interface AgroforestreeApiResponse {
  donationId: string;
  status: 'PENDING_PLANTING' | 'PLANTED' | 'FAILED';
  createdAt: string;
  certificateUrl?: string;
}

// Tipos internos do middleware
export interface DonationAttempt {
  id: string;
  sympla_order_id: string;
  sympla_event_id: string;
  status: 'PENDING_USER_ACTION' | 'CONSENT_GIVEN' | 'COMPLETED' | 'DECLINED' | 'CANCELLED';
  donation_token: string;
  created_at: Date;
  updated_at: Date;
  // Dados do pedido Sympla
  donor_name?: string;
  donor_email?: string;
  event_name?: string;
  order_amount?: number;
}

export interface DonationRecord {
  id: string;
  donation_attempt_id: string;
  agroforestree_donation_id: string;
  status_from_agroforestree: string;
  certificate_url?: string;
  created_at: Date;
  updated_at: Date;
}

// Configurações do ambiente
export interface EnvironmentConfig {
  PORT: number;
  SYMPLA_WEBHOOK_SECRET: string;
  AGROFORESTREE_API_URL: string;
  AGROFORESTREE_API_KEY: string;
  NODE_ENV: 'development' | 'production' | 'test';
}