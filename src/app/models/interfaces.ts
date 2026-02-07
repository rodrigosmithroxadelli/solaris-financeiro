export type StatusOs = 'ABERTA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';

export interface Veiculo {
  placa?: string;
  marca?: string;
  modelo?: string;
  cor?: string;
  ano?: string;
}

export interface ServicoOs {
  nome: string;
  valor: number;
}

export interface Os {
  id?: string;
  empresaId?: string;
  cliente_nome: string;
  cliente_telefone?: string;
  veiculo: Veiculo;
  servicos: ServicoOs[];
  total: number;
  status: StatusOs;
  data_criacao: Date;
}

export type StatusLancamento = 'PENDENTE' | 'RECEBIDO' | 'PAGO' | 'ATRASADO' | 'CONFIRMADO' | 'CANCELADO' | 'ESTORNADO';
export type TipoLancamento = 'ENTRADA' | 'SAIDA';

export interface Lancamento {
  id: string;
  id_os: string;
  empresaId?: string;
  valor: number;
  dataCompetencia?: Date;
  data_vencimento: Date;
  data_pagamento: Date | null;
  status: StatusLancamento;
  tipo: TipoLancamento;
  categoria?: string;
  metodo_pagamento?: string;
  descricao?: string;
  cliente_nome?: string;
  cliente_telefone?: string;
  cliente_endereco?: string;
}
