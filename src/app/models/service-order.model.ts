// src/app/models/service-order.model.ts

import { Timestamp } from '@angular/fire/firestore';

// 1. Cliente e Veículo
export interface Client {
  id?: string;
  tenantId: string; // Chave de isolamento (SaaS)
  name: string;
  whatsapp: string;
  email?: string;
  vehicles: Vehicle[];
}

export interface Vehicle {
  plate: string;
  brand: string;
  model: string;
  color: string;
  year?: string;
}

// 2. Itens da Ordem (Serviço ou Produto)
export interface OrderItem {
  id: string; // ID do catálogo
  type: 'SERVICE' | 'PRODUCT';
  name: string;
  quantity: number;
  unitPrice: number;
  costPrice: number; // Para cálculo de lucro
  discount: number;
  total: number; // (unitPrice * qts) - discount
  workerId?: string; // ID do funcionário para comissão
}

// 3. Pagamento e Financeiro (Regras Críticas)
export interface Payment {
  method: 'CASH' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO' | 'TRANSFERENCIA';
  installments: number; // Parcelas
  grossValue: number; // Valor pago pelo cliente
  taxRate: number; // Taxa da maquininha (%)
  netValue: number; // Valor Líquido (gross - taxa)
  dueDate: Timestamp; // Data de recebimento real
}

export type ServiceStatus = 'AGUARDANDO_ACAO' | 'CONCLUIDA' | 'CANCELADA';
export type PaymentStatus = 'PENDENTE' | 'PAGO';
export type ServicePaymentMethod = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'boleto' | 'transferencia';

// 4. A Ordem de Serviço (Entidade Principal)
export interface ServiceOrder {
  id?: string;
  tenantId: string;
  number: number; // Sequencial amigável (#1001)
  
  // Dados Básicos
  clientId: string;
  clientName: string; // Desnormalizado para leitura rápida
  vehicle: Vehicle;
  
  status: 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'CONCLUIDA' | 'CANCELADA';
  serviceStatus?: ServiceStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: ServicePaymentMethod;
  serviceValue?: number;
  linkedTransactionId?: string;
  
  // Checklist Visual (Fotos e Avarias)
  checklist: {
    fuelLevel: number; // 0 a 100
    notes: string;
    photosUrls: string[];
    completedAt?: Timestamp; // Changed to Timestamp
  };

  // Valores
  items: OrderItem[];
  financial: {
    subtotal: number;
    globalDiscount: number;
    totalPrice: number;
    payments: Payment[];
    balanceDue: number; // Quanto falta pagar (totalPrice - soma dos payments)
  };

  timestamps: {
    created: Timestamp; // Firestore Timestamp
    scheduled?: Timestamp;
    finished?: Timestamp;
  };
}
