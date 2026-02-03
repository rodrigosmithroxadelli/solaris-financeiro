export interface Transaction {
  id?: string;
  type: 'entrada' | 'saida';
  title: string;
  amount: number;
  category: string;
  paymentMethod: 'pix' | 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'transferencia';
  paymentStatus?: 'PENDENTE' | 'PAGO';
  serviceOrderId?: string;
  date: string; // ISO String
  description?: string;
  clientName?: string;
  clientPhone?: string;
  clientAddress?: string;
}

export const CATEGORIAS_SOLARIS = {
  entradas: ['Lavagem Simples', 'Higienização', 'Polimento', 'Vitrificação', 'Martelinho', 'Lavagem Completa', 'Outros'],
  saidas: ['Produtos', 'Aluguel', 'Água/Luz', 'Pagamento Funcionário', 'Manutenção', 'Outros']
};
