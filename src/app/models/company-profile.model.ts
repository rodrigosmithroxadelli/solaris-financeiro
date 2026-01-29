// src/app/models/company-profile.model.ts
export interface CompanyProfile {
  id?: string; // Document ID in Firestore, geralmente o tenantId (ID do inquilino)
  tenantId: string; // ID do inquilino ao qual este perfil de empresa pertence
  name: string; // Nome da empresa
  contactPhone?: string; // Telefone de contato da empresa
  contactEmail?: string; // E-mail de contato da empresa
  address?: string; // Endereço da empresa
  // Adicionar outros detalhes da empresa conforme necessário, como logoUrl, CNPJ, etc.
}
