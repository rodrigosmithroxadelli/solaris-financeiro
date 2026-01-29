// src/app/models/client.model.ts

export interface Vehicle {
  plate: string;
  brand: string;
  model: string;
  color: string;
  year?: string;
}

export interface Client {
  id?: string;
  tenantId: string; // Chave de isolamento (SaaS)
  name: string;
  whatsapp: string;
  email?: string;
  vehicles: Vehicle[];
}