// src/app/models/catalog.model.ts
export interface CatalogItem {
  id?: string;
  tenantId: string;
  name: string;
  type: 'SERVICE' | 'PRODUCT';
  unitPrice: number;
  costPrice?: number; // Only for PRODUCT type
}
