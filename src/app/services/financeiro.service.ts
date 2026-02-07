import { Injectable, inject, EnvironmentInjector, runInInjectionContext, InjectionToken } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Observable, combineLatest, of, firstValueFrom } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { Lancamento } from '../models/interfaces';
import { AuthService } from './auth.service';

export interface ResumoFinanceiro {
  saldoRealizado: number;
  previsaoEntrada: number;
  previsaoSaida: number;
}

export interface PeriodoResumo {
  totalEntradas: number;
  totalSaidas: number;
  saldo: number;
  date: string;
}

export interface RelatorioPeriodo {
  resumo: PeriodoResumo;
  lancamentos: Lancamento[];
  totalTransacoes: number;
  categoryEntries: Array<{ category: string; amount: number }>;
  paymentMethodEntries: Array<{ method: string; amount: number }>;
  averageEntradas: number;
  averageSaidas: number;
  maxAmountForPercentage: number;
}

export interface SalesBreakdown {
  debito: number;
  credito: number;
  pix: number;
  dinheiro: number;
  boleto: number;
  transferencias: number;
}

export interface MonthlyChartData {
  labels: string[];
  realized: number[];
  remaining: number[];
  marker: Array<[number, number]>;
}

export interface ComparativoValores {
  primaryValue: number;
  secondaryValue: number;
  primaryPercent: number;
  secondaryPercent: number;
}

export interface DreResumo {
  receitaBruta: number;
  despesas: number;
  resultadoOperacional: number;
  margem: number;
}

export interface DreComparativo {
  atual: DreResumo;
  anterior: DreResumo;
}

export interface ComparativoMes {
  atual: number;
  anterior: number;
}

export interface RankingEntry {
  label: string;
  amount: number;
}

export interface RankingComparativo {
  atual: RankingEntry[];
  anterior: RankingEntry[];
}

export interface IndicadoresEstrategicos {
  ticketMedio: ComparativoMes;
  conversaoOs: ComparativoMes;
  receitaPorCliente: RankingComparativo;
  receitaPorServico: RankingComparativo;
}

export const LANCAMENTOS_SOURCE = new InjectionToken<Observable<Lancamento[]>>('LANCAMENTOS_SOURCE');

@Injectable({
  providedIn: 'root'
})
export class FinanceiroService {
  private firestore = inject(Firestore);
  private functions = inject(Functions);
  private authService = inject(AuthService);
  private environmentInjector = inject(EnvironmentInjector);
  private lancamentosSource = inject(LANCAMENTOS_SOURCE, { optional: true });
  private collectionRefByTenant = new Map<string, ReturnType<typeof collection>>();

  private getCollectionRef(tenantId: string): ReturnType<typeof collection> {
    const cached = this.collectionRefByTenant.get(tenantId);
    if (cached) {
      return cached;
    }
    const ref = runInInjectionContext(this.environmentInjector, () =>
      collection(this.firestore, 'empresas', tenantId, 'lancamentosFinanceiros')
    );
    this.collectionRefByTenant.set(tenantId, ref);
    return ref;
  }

  private getLancamentoRef(tenantId: string, id: string) {
    return runInInjectionContext(this.environmentInjector, () =>
      doc(this.firestore, 'empresas', tenantId, 'lancamentosFinanceiros', id)
    );
  }

  private lancamentos$ = (this.lancamentosSource ?? this.authService.currentUser$.pipe(
    switchMap(user => {
      if (!user?.tenantId) {
        console.error('FinanceiroService: usuário ou tenantId ausente.');
        return of([] as Lancamento[]);
      }
      const ref = this.getCollectionRef(user.tenantId);
      return runInInjectionContext(this.environmentInjector, () =>
        collectionData(ref, { idField: 'id' }) as Observable<Lancamento[]>
      );
    })
  )).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  getLancamentos$(): Observable<Lancamento[]> {
    return this.lancamentos$;
  }

  readonly caixaAtual$ = this.lancamentos$.pipe(
    map(lancamentos => {
      const entradas = this.sumLancamentos(lancamentos, 'ENTRADA', true);
      const saidas = this.sumLancamentos(lancamentos, 'SAIDA', true);
      return entradas - saidas;
    })
  );

  readonly entradasConfirmadas$ = this.lancamentos$.pipe(
    map(lancamentos => this.sumLancamentos(lancamentos, 'ENTRADA', true))
  );

  readonly saidasConfirmadas$ = this.lancamentos$.pipe(
    map(lancamentos => this.sumLancamentos(lancamentos, 'SAIDA', true))
  );

  readonly entradasDia$ = this.lancamentos$.pipe(
    map(lancamentos => this.sumPeriodo(lancamentos, 'ENTRADA', 'day'))
  );

  readonly saidasDia$ = this.lancamentos$.pipe(
    map(lancamentos => this.sumPeriodo(lancamentos, 'SAIDA', 'day'))
  );

  readonly entradasMes$ = this.lancamentos$.pipe(
    map(lancamentos => this.sumPeriodo(lancamentos, 'ENTRADA', 'month'))
  );

  readonly saidasMes$ = this.lancamentos$.pipe(
    map(lancamentos => this.sumPeriodo(lancamentos, 'SAIDA', 'month'))
  );

  readonly pendentesEntrada$ = this.lancamentos$.pipe(
    map(lancamentos => this.sumPendentes(lancamentos, 'ENTRADA', new Date()))
  );

  readonly pendentesSaida$ = this.lancamentos$.pipe(
    map(lancamentos => this.sumPendentes(lancamentos, 'SAIDA', new Date()))
  );

  readonly saldoProjetado$ = this.lancamentos$.pipe(
    map(lancamentos => {
      const hoje = new Date();
      const pendentesEntrada = this.sumPendentes(lancamentos, 'ENTRADA', hoje);
      const pendentesSaida = this.sumPendentes(lancamentos, 'SAIDA', hoje);
      return this.sumLancamentos(lancamentos, 'ENTRADA', true)
        - this.sumLancamentos(lancamentos, 'SAIDA', true)
        + pendentesEntrada
        - pendentesSaida;
    })
  );

  readonly resultadoPeriodo$ = this.lancamentos$.pipe(
    map(lancamentos => {
      const { start, end } = this.getMonthRange(new Date());
      const entradas = this.sumConfirmadasPorCompetencia(lancamentos, 'ENTRADA', start, end);
      const saidas = this.sumConfirmadasPorCompetencia(lancamentos, 'SAIDA', start, end);
      return entradas - saidas;
    })
  );

  readonly resultadoCompetencia$ = this.resultadoPeriodo$;

  readonly resumoDia$ = this.lancamentos$.pipe(
    map(lancamentos => {
      const { start, end } = this.getDayRange(new Date());
      const entradas = this.sumConfirmadasPorPagamento(lancamentos, 'ENTRADA', start, end);
      const saidas = this.sumConfirmadasPorPagamento(lancamentos, 'SAIDA', start, end);
      return { entradas, saidas, saldo: entradas - saidas };
    })
  );

  readonly resumoMes$ = this.lancamentos$.pipe(
    map(lancamentos => {
      const { start, end } = this.getMonthRange(new Date());
      const entradas = this.sumConfirmadasPorPagamento(lancamentos, 'ENTRADA', start, end);
      const saidas = this.sumConfirmadasPorPagamento(lancamentos, 'SAIDA', start, end);
      return { entradas, saidas, saldo: entradas - saidas };
    })
  );

  readonly comparativoRealizadoProjetado$ = combineLatest([
    this.caixaAtual$,
    this.saldoProjetado$
  ]).pipe(
    map(([realizado, projetado]) => this.buildComparativo(realizado, projetado))
  );

  readonly comparativoEntradasSaidasMes$ = combineLatest([
    this.entradasMes$,
    this.saidasMes$
  ]).pipe(
    map(([entradas, saidas]) => this.buildComparativo(entradas, saidas))
  );

  readonly dreComparativo$ = this.lancamentos$.pipe(
    map(lancamentos => {
      const hoje = new Date();
      const atualRange = this.getMonthRange(hoje);
      const anteriorRange = this.getMonthRange(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1));
      return {
        atual: this.buildDre(lancamentos, atualRange.start, atualRange.end),
        anterior: this.buildDre(lancamentos, anteriorRange.start, anteriorRange.end)
      };
    })
  );

  readonly indicadoresEstrategicos$ = this.lancamentos$.pipe(
    map(lancamentos => {
      const hoje = new Date();
      const atualRange = this.getMonthRange(hoje);
      const anteriorRange = this.getMonthRange(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1));
      const entradasAtual = this.filterConfirmadasPorPagamento(lancamentos, 'ENTRADA', atualRange.start, atualRange.end);
      const entradasAnterior = this.filterConfirmadasPorPagamento(lancamentos, 'ENTRADA', anteriorRange.start, anteriorRange.end);
      return {
        ticketMedio: {
          atual: this.buildTicketMedio(entradasAtual),
          anterior: this.buildTicketMedio(entradasAnterior)
        },
        conversaoOs: {
          atual: this.buildConversaoOs(lancamentos, atualRange.start, atualRange.end),
          anterior: this.buildConversaoOs(lancamentos, anteriorRange.start, anteriorRange.end)
        },
        receitaPorCliente: {
          atual: this.buildRanking(entradasAtual, lancamento => this.resolveLabel(lancamento.cliente_nome, 'Sem cliente')),
          anterior: this.buildRanking(entradasAnterior, lancamento => this.resolveLabel(lancamento.cliente_nome, 'Sem cliente'))
        },
        receitaPorServico: {
          atual: this.buildRanking(entradasAtual, lancamento => this.resolveLabel(lancamento.categoria, 'Sem categoria')),
          anterior: this.buildRanking(entradasAnterior, lancamento => this.resolveLabel(lancamento.categoria, 'Sem categoria'))
        }
      } as IndicadoresEstrategicos;
    })
  );

  getSaldoAtual(): Observable<number> {
    return this.caixaAtual$;
  }

  getContasAReceber(): Observable<Lancamento[]> {
    return this.authService.currentUser$.pipe(
      switchMap(user => {
        if (!user?.tenantId) {
          console.error('FinanceiroService: usuário ou tenantId ausente.');
          return of([] as Lancamento[]);
        }
        const pendentesQuery = query(
          this.getCollectionRef(user.tenantId),
          where('tipo', '==', 'ENTRADA'),
          where('status', '==', 'PENDENTE'),
          orderBy('data_vencimento', 'asc')
        );
        return runInInjectionContext(this.environmentInjector, () =>
          collectionData(pendentesQuery, { idField: 'id' }) as Observable<Lancamento[]>
        );
      })
    );
  }

  async createLancamento(payload: Partial<Lancamento>): Promise<void> {
    const currentUser = await firstValueFrom(this.authService.currentUser$);
    const empresaId = currentUser?.tenantId;
    if (!empresaId) {
      console.error('FinanceiroService: Cannot create lancamento, tenantId is missing.');
      throw new Error('Tenant ID is required to create a lancamento.');
    }
    const dataCompetencia = payload.dataCompetencia ?? payload.data_vencimento ?? new Date();
    const data: Lancamento = {
      id: '',
      id_os: payload.id_os ?? '',
      empresaId,
      valor: payload.valor ?? 0,
      dataCompetencia,
      data_vencimento: payload.data_vencimento ?? new Date(),
      data_pagamento: payload.data_pagamento ?? null,
      status: payload.status ?? 'PENDENTE',
      tipo: payload.tipo ?? 'ENTRADA',
      categoria: payload.categoria,
      metodo_pagamento: payload.metodo_pagamento,
      descricao: payload.descricao,
      cliente_nome: payload.cliente_nome,
      cliente_telefone: payload.cliente_telefone,
      cliente_endereco: payload.cliente_endereco
    };
    const { id, ...dataWithoutId } = data;
    await runInInjectionContext(this.environmentInjector, () =>
      addDoc(this.getCollectionRef(empresaId), dataWithoutId)
    );
  }

  async updateLancamento(id: string, payload: Partial<Lancamento>): Promise<void> {
    const currentUser = await firstValueFrom(this.authService.currentUser$);
    const empresaId = currentUser?.tenantId;
    if (!empresaId) {
      console.error('FinanceiroService: Cannot update lancamento, tenantId is missing.');
      throw new Error('Tenant ID is required to update a lancamento.');
    }
    const docRef = this.getLancamentoRef(empresaId, id);
    await runInInjectionContext(this.environmentInjector, () =>
      updateDoc(docRef, payload)
    );
  }

  async deleteLancamento(id: string): Promise<void> {
    const currentUser = await firstValueFrom(this.authService.currentUser$);
    const empresaId = currentUser?.tenantId;
    if (!empresaId) {
      console.error('FinanceiroService: Cannot delete lancamento, tenantId is missing.');
      throw new Error('Tenant ID is required to delete a lancamento.');
    }
    const docRef = this.getLancamentoRef(empresaId, id);
    await runInInjectionContext(this.environmentInjector, () =>
      deleteDoc(docRef)
    );
  }

  async receberParcela(id: string): Promise<void> {
    const currentUser = await firstValueFrom(this.authService.currentUser$);
    const empresaId = currentUser?.tenantId;
    if (!empresaId) {
      console.error('FinanceiroService: Cannot confirm lancamento, tenantId is missing.');
      throw new Error('Tenant ID is required to confirm a lancamento.');
    }
    const confirmarLancamento = httpsCallable(this.functions, 'confirmarLancamento');
    await confirmarLancamento({ empresaId, lancamentoId: id, status: 'RECEBIDO' });
  }

  filtrarRelatorio(inicio: Date, fim: Date): Observable<{ lancamentos: Lancamento[]; resumo: ResumoFinanceiro }> {
    const start = this.startOfDay(inicio);
    const end = this.endOfDay(fim);
    return this.lancamentos$.pipe(
      map(lancamentos => {
        const filtrados = lancamentos.filter(lancamento => {
          const baseDate = this.isConfirmado(lancamento)
            ? this.toDateValue(lancamento.data_pagamento)
            : this.toDateValue(lancamento.data_vencimento);
          return baseDate ? this.isInRange(baseDate, start, end) : false;
        });
        return { lancamentos: filtrados, resumo: this.calcularResumo(filtrados, start, end) };
      })
    );
  }

  getPeriodoResumo(inicio: Date, fim: Date): Observable<{ entradas: number; saidas: number; saldo: number }> {
    const start = this.startOfDay(inicio);
    const end = this.endOfDay(fim);
    return this.lancamentos$.pipe(
      map(lancamentos => {
        const entradas = this.sumConfirmadasPorCompetencia(lancamentos, 'ENTRADA', start, end);
        const saidas = this.sumConfirmadasPorCompetencia(lancamentos, 'SAIDA', start, end);
        return { entradas, saidas, saldo: entradas - saidas };
      })
    );
  }

  getResumoPagamento(inicio: Date, fim: Date): Observable<{ entradas: number; saidas: number; saldo: number }> {
    const start = this.startOfDay(inicio);
    const end = this.endOfDay(fim);
    return this.lancamentos$.pipe(
      map(lancamentos => {
        const entradas = this.sumConfirmadasPorPagamento(lancamentos, 'ENTRADA', start, end);
        const saidas = this.sumConfirmadasPorPagamento(lancamentos, 'SAIDA', start, end);
        return { entradas, saidas, saldo: entradas - saidas };
      })
    );
  }

  getSalesBreakdown(inicio: Date, fim: Date): Observable<SalesBreakdown> {
    const start = this.startOfDay(inicio);
    const end = this.endOfDay(fim);
    return this.lancamentos$.pipe(
      map(lancamentos => {
        const breakdown: SalesBreakdown = {
          debito: 0,
          credito: 0,
          pix: 0,
          dinheiro: 0,
          boleto: 0,
          transferencias: 0
        };
        lancamentos
          .filter(lancamento => lancamento.tipo === 'ENTRADA' && this.isConfirmado(lancamento))
          .filter(lancamento => {
            const pagamento = this.toDateValue(lancamento.data_pagamento);
            return pagamento ? this.isInRange(pagamento, start, end) : false;
          })
          .forEach(lancamento => {
            const metodo = this.normalizePaymentMethod(lancamento.metodo_pagamento);
            switch (metodo) {
              case 'cartao_debito':
              case 'debito':
                breakdown.debito += lancamento.valor;
                break;
              case 'cartao_credito':
              case 'credito':
                breakdown.credito += lancamento.valor;
                break;
              case 'pix':
                breakdown.pix += lancamento.valor;
                break;
              case 'dinheiro':
                breakdown.dinheiro += lancamento.valor;
                break;
              case 'boleto':
                breakdown.boleto += lancamento.valor;
                break;
              case 'transferencia':
                breakdown.transferencias += lancamento.valor;
                break;
              default:
                breakdown.dinheiro += lancamento.valor;
                break;
            }
          });
        return breakdown;
      })
    );
  }

  getMonthlyChartData(year: number, target: number): Observable<MonthlyChartData> {
    const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return this.lancamentos$.pipe(
      map(lancamentos => {
        const realized = Array.from({ length: 12 }, () => 0);
        lancamentos
          .filter(lancamento => lancamento.tipo === 'ENTRADA' && this.isConfirmado(lancamento))
          .forEach(lancamento => {
            const pagamento = this.toDateValue(lancamento.data_pagamento);
            if (!pagamento || pagamento.getFullYear() !== year) {
              return;
            }
            realized[pagamento.getMonth()] += lancamento.valor;
          });
        const remaining = realized.map(value => Math.max(target - value, 0));
        const maxRealized = Math.max(...realized, target, 1);
        const markerHeight = Math.max(maxRealized * 0.02, 1);
        const marker = realized.map(value => (
          value > 0 ? [Math.max(value - markerHeight, 0), value] as [number, number] : [0, 0] as [number, number]
        ));
        return { labels, realized, remaining, marker };
      })
    );
  }

  getRelatorioPeriodo(inicio: Date, fim: Date): Observable<RelatorioPeriodo> {
    const start = this.startOfDay(inicio);
    const end = this.endOfDay(fim);
    return this.lancamentos$.pipe(
      map(lancamentos => {
        const confirmados = lancamentos
          .filter(lancamento => this.isConfirmado(lancamento))
          .filter(lancamento => {
            const competencia = this.getCompetenciaDate(lancamento);
            return competencia ? this.isInRange(competencia, start, end) : false;
          });

        const totalEntradas = confirmados
          .filter(lancamento => lancamento.tipo === 'ENTRADA')
          .reduce((acc, curr) => acc + curr.valor, 0);
        const totalSaidas = confirmados
          .filter(lancamento => lancamento.tipo === 'SAIDA')
          .reduce((acc, curr) => acc + curr.valor, 0);

        const categoryData = confirmados.reduce((acc, lancamento) => {
          const categoria = lancamento.categoria || 'Sem categoria';
          acc[categoria] = (acc[categoria] || 0) + lancamento.valor;
          return acc;
        }, {} as Record<string, number>);

        const paymentMethodData = confirmados
          .filter(lancamento => lancamento.tipo === 'ENTRADA')
          .reduce((acc, lancamento) => {
            const metodo = this.normalizePaymentMethod(lancamento.metodo_pagamento);
            acc[metodo] = (acc[metodo] || 0) + lancamento.valor;
            return acc;
          }, {} as Record<string, number>);

        const categoryEntries = Object.entries(categoryData)
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount);

        const paymentMethodEntries = Object.entries(paymentMethodData)
          .map(([method, amount]) => ({ method: this.getPaymentMethodLabel(method), amount }))
          .sort((a, b) => b.amount - a.amount);

        const entradasCount = confirmados.filter(l => l.tipo === 'ENTRADA').length;
        const saidasCount = confirmados.filter(l => l.tipo === 'SAIDA').length;
        const averageEntradas = entradasCount > 0 ? totalEntradas / entradasCount : 0;
        const averageSaidas = saidasCount > 0 ? totalSaidas / saidasCount : 0;

        const maxAmountForPercentage = Math.max(
          totalEntradas,
          totalSaidas,
          ...Object.values(categoryData),
          ...Object.values(paymentMethodData),
          0
        );

        return {
          resumo: {
            totalEntradas,
            totalSaidas,
            saldo: totalEntradas - totalSaidas,
            date: inicio.toISOString()
          },
          lancamentos: confirmados,
          totalTransacoes: confirmados.length,
          categoryEntries,
          paymentMethodEntries,
          averageEntradas,
          averageSaidas,
          maxAmountForPercentage
        };
      })
    );
  }

  getSaldoTotal$(): Observable<number> {
    return this.caixaAtual$;
  }

  getResumoDashboard$(): Observable<{
    caixaAtual: number;
    entradasDia: number;
    entradasMes: number;
    saidasMes: number;
    saldoProjetado: number;
    resultadoPeriodo: number;
  }> {
    return combineLatest([
      this.caixaAtual$,
      this.entradasDia$,
      this.entradasMes$,
      this.saidasMes$,
      this.saldoProjetado$,
      this.resultadoPeriodo$
    ]).pipe(
      map(([caixaAtual, entradasDia, entradasMes, saidasMes, saldoProjetado, resultadoPeriodo]) => ({
        caixaAtual,
        entradasDia,
        entradasMes,
        saidasMes,
        saldoProjetado,
        resultadoPeriodo
      }))
    );
  }

  private sumLancamentos(lancamentos: Lancamento[], tipo: Lancamento['tipo'], somenteConfirmados: boolean): number {
    return lancamentos
      .filter(lancamento => lancamento.tipo === tipo)
      .filter(lancamento => !somenteConfirmados || this.isConfirmado(lancamento))
      .reduce((acc, curr) => acc + curr.valor, 0);
  }

  private sumPeriodo(lancamentos: Lancamento[], tipo: Lancamento['tipo'], period: 'day' | 'month'): number {
    const { start, end } = period === 'day' ? this.getDayRange(new Date()) : this.getMonthRange(new Date());
    return this.sumConfirmadasPorPagamento(lancamentos, tipo, start, end);
  }

  private sumPendentes(lancamentos: Lancamento[], tipo: Lancamento['tipo'], base: Date): number {
    return lancamentos
      .filter(lancamento => lancamento.tipo === tipo)
      .filter(lancamento => this.isPendente(lancamento))
      .filter(lancamento => {
        const vencimento = this.toDateValue(lancamento.data_vencimento);
        return vencimento ? vencimento > base : false;
      })
      .reduce((acc, curr) => acc + curr.valor, 0);
  }

  private sumConfirmadasPorPagamento(lancamentos: Lancamento[], tipo: Lancamento['tipo'], start: Date, end: Date): number {
    return lancamentos
      .filter(lancamento => lancamento.tipo === tipo && this.isConfirmado(lancamento))
      .filter(lancamento => {
        const pagamento = this.toDateValue(lancamento.data_pagamento);
        return pagamento ? this.isInRange(pagamento, start, end) : false;
      })
      .reduce((acc, curr) => acc + curr.valor, 0);
  }

  private sumConfirmadasPorCompetencia(lancamentos: Lancamento[], tipo: Lancamento['tipo'], start: Date, end: Date): number {
    return lancamentos
      .filter(lancamento => lancamento.tipo === tipo && this.isConfirmado(lancamento))
      .filter(lancamento => {
        const competencia = this.getCompetenciaDate(lancamento);
        return competencia ? this.isInRange(competencia, start, end) : false;
      })
      .reduce((acc, curr) => acc + curr.valor, 0);
  }

  private filterConfirmadasPorPagamento(lancamentos: Lancamento[], tipo: Lancamento['tipo'], start: Date, end: Date): Lancamento[] {
    return lancamentos
      .filter(lancamento => lancamento.tipo === tipo && this.isConfirmado(lancamento))
      .filter(lancamento => {
        const pagamento = this.toDateValue(lancamento.data_pagamento);
        return pagamento ? this.isInRange(pagamento, start, end) : false;
      });
  }

  private isConfirmado(lancamento: Lancamento): boolean {
    return lancamento.status === 'RECEBIDO' || lancamento.status === 'PAGO' || lancamento.status === 'CONFIRMADO';
  }

  private isPendente(lancamento: Lancamento): boolean {
    return lancamento.status === 'PENDENTE';
  }

  private getDayRange(date: Date): { start: Date; end: Date } {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    return { start, end };
  }

  private getMonthRange(date: Date): { start: Date; end: Date } {
    const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  private normalizePaymentMethod(method?: string): string {
    if (!method) {
      return 'dinheiro';
    }
    switch (method) {
      case 'cartao_credito':
      case 'credito':
        return 'cartao_credito';
      case 'cartao_debito':
      case 'debito':
        return 'cartao_debito';
      case 'pix':
        return 'pix';
      case 'dinheiro':
        return 'dinheiro';
      case 'boleto':
        return 'boleto';
      case 'transferencia':
        return 'transferencia';
      default:
        return method;
    }
  }

  private getPaymentMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      pix: 'PIX',
      dinheiro: 'Dinheiro',
      cartao_credito: 'Cartão de Crédito',
      cartao_debito: 'Cartão de Débito',
      boleto: 'Boleto',
      transferencia: 'Transferência'
    };
    return labels[method] || method;
  }

  private calcularResumo(lancamentos: Lancamento[], inicio: Date, fim: Date): ResumoFinanceiro {
    return lancamentos.reduce(
      (acc, lancamento) => {
        if (lancamento.tipo === 'ENTRADA') {
          if (this.isConfirmado(lancamento)) {
            const pagamento = this.toDateValue(lancamento.data_pagamento);
            if (pagamento && this.isInRange(pagamento, inicio, fim)) {
              acc.saldoRealizado += lancamento.valor;
            }
          } else if (this.isPendente(lancamento)) {
            const vencimento = this.toDateValue(lancamento.data_vencimento);
            if (vencimento && this.isInRange(vencimento, inicio, fim)) {
              acc.previsaoEntrada += lancamento.valor;
            }
          }
        }

        if (lancamento.tipo === 'SAIDA') {
          if (this.isConfirmado(lancamento)) {
            const pagamento = this.toDateValue(lancamento.data_pagamento);
            if (pagamento && this.isInRange(pagamento, inicio, fim)) {
              acc.saldoRealizado -= lancamento.valor;
            }
          } else if (this.isPendente(lancamento)) {
            const vencimento = this.toDateValue(lancamento.data_vencimento);
            if (vencimento && this.isInRange(vencimento, inicio, fim)) {
              acc.previsaoSaida += lancamento.valor;
            }
          }
        }

        return acc;
      },
      { saldoRealizado: 0, previsaoEntrada: 0, previsaoSaida: 0 }
    );
  }

  private toDateValue(value: unknown): Date | null {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate();
    }
    return null;
  }

  private getCompetenciaDate(lancamento: Lancamento): Date | null {
    return this.toDateValue(lancamento.dataCompetencia ?? lancamento.data_vencimento);
  }

  private isInRange(date: Date, start: Date, end: Date): boolean {
    return date >= start && date <= end;
  }

  private buildComparativo(primary: number, secondary: number): ComparativoValores {
    const base = Math.max(Math.abs(primary), Math.abs(secondary), 1);
    return {
      primaryValue: primary,
      secondaryValue: secondary,
      primaryPercent: (Math.abs(primary) / base) * 100,
      secondaryPercent: (Math.abs(secondary) / base) * 100
    };
  }

  private buildDre(lancamentos: Lancamento[], start: Date, end: Date): DreResumo {
    const receitaBruta = this.sumConfirmadasPorCompetencia(lancamentos, 'ENTRADA', start, end);
    const despesas = this.sumConfirmadasPorCompetencia(lancamentos, 'SAIDA', start, end);
    const resultadoOperacional = receitaBruta - despesas;
    const margem = receitaBruta > 0 ? resultadoOperacional / receitaBruta : 0;
    return { receitaBruta, despesas, resultadoOperacional, margem };
  }

  private buildTicketMedio(lancamentos: Lancamento[]): number {
    if (!lancamentos.length) {
      return 0;
    }
    const total = lancamentos.reduce((acc, curr) => acc + curr.valor, 0);
    return total / lancamentos.length;
  }

  private buildConversaoOs(lancamentos: Lancamento[], start: Date, end: Date): number {
    const base = lancamentos
      .filter(lancamento => lancamento.tipo === 'ENTRADA')
      .filter(lancamento => {
        const competencia = this.getCompetenciaDate(lancamento);
        return competencia ? this.isInRange(competencia, start, end) : false;
      });
    const total = base.length;
    if (!total) {
      return 0;
    }
    const confirmados = base.filter(lancamento => this.isConfirmado(lancamento)).length;
    return confirmados / total;
  }

  private buildRanking(lancamentos: Lancamento[], getLabel: (l: Lancamento) => string): RankingEntry[] {
    const grouped = lancamentos.reduce((acc, lancamento) => {
      const label = getLabel(lancamento);
      acc[label] = (acc[label] || 0) + lancamento.valor;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(grouped)
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }

  private resolveLabel(value: string | undefined, fallback: string): string {
    if (!value || !value.trim()) {
      return fallback;
    }
    return value;
  }

  private startOfDay(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private endOfDay(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(23, 59, 59, 999);
    return normalized;
  }
}
