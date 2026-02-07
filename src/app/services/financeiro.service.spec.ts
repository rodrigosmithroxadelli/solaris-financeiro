import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { Firestore } from '@angular/fire/firestore';
import { Lancamento } from '../models/interfaces';
import { FinanceiroService, LANCAMENTOS_SOURCE } from './financeiro.service';

const snapshotDate = new Date(2026, 1, 20, 12, 0, 0);
const makeDate = (year: number, month: number, day: number): Date => new Date(year, month - 1, day, 12, 0, 0);

describe('FinanceiroService', () => {
  let service: FinanceiroService;
  let lancamentosSubject: BehaviorSubject<Lancamento[]>;
  const buildLancamento = (overrides: Partial<Lancamento>): Lancamento => ({
    id: overrides.id ?? 'lancamento-1',
    id_os: overrides.id_os ?? 'os-1',
    valor: overrides.valor ?? 0,
    data_vencimento: overrides.data_vencimento ?? new Date(),
    data_pagamento: overrides.data_pagamento ?? null,
    status: overrides.status ?? 'PENDENTE',
    tipo: overrides.tipo ?? 'ENTRADA',
    categoria: overrides.categoria,
    metodo_pagamento: overrides.metodo_pagamento,
    descricao: overrides.descricao,
    cliente_nome: overrides.cliente_nome,
    cliente_telefone: overrides.cliente_telefone,
    cliente_endereco: overrides.cliente_endereco
  });
  const getMetrics = async () => {
    const [caixaAtual, entradas, saidas, resultadoCompetencia, saldoProjetado] = await Promise.all([
      firstValueFrom(service.caixaAtual$),
      firstValueFrom(service.entradasConfirmadas$),
      firstValueFrom(service.saidasConfirmadas$),
      firstValueFrom(service.resultadoCompetencia$),
      firstValueFrom(service.saldoProjetado$)
    ]);
    return { caixaAtual, entradas, saidas, resultadoCompetencia, saldoProjetado };
  };
  const expectMetrics = async (expected: {
    caixaAtual: number;
    entradas: number;
    saidas: number;
    resultadoCompetencia: number;
    saldoProjetado: number;
  }) => {
    const metrics = await getMetrics();
    expect(metrics.caixaAtual).toBe(expected.caixaAtual);
    expect(metrics.entradas).toBe(expected.entradas);
    expect(metrics.saidas).toBe(expected.saidas);
    expect(metrics.resultadoCompetencia).toBe(expected.resultadoCompetencia);
    expect(metrics.saldoProjetado).toBe(expected.saldoProjetado);
  };

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(snapshotDate);
    lancamentosSubject = new BehaviorSubject<Lancamento[]>([]);

    TestBed.configureTestingModule({
      providers: [
        FinanceiroService,
        { provide: LANCAMENTOS_SOURCE, useValue: lancamentosSubject.asObservable() },
        { provide: Firestore, useValue: {} }
      ]
    });

    service = TestBed.inject(FinanceiroService);
  });

  afterEach(() => {
    lancamentosSubject.complete();
    jasmine.clock().uninstall();
  });

  it('calcula caixa com entrada confirmada', async () => {
    const now = new Date(2024, 5, 12, 10, 30);
    lancamentosSubject.next([
      buildLancamento({
        id: 'l1',
        valor: 250,
        data_vencimento: now,
        data_pagamento: now,
        status: 'RECEBIDO',
        tipo: 'ENTRADA'
      })
    ]);

    const caixa = await firstValueFrom(service.caixaAtual$);
    const entradas = await firstValueFrom(service.entradasConfirmadas$);

    expect(caixa).toBe(250);
    expect(entradas).toBe(250);
  });

  it('calcula caixa com saída confirmada', async () => {
    const now = new Date(2024, 5, 12, 14, 15);
    lancamentosSubject.next([
      buildLancamento({
        id: 'l2',
        valor: 80,
        data_vencimento: now,
        data_pagamento: now,
        status: 'PAGO',
        tipo: 'SAIDA'
      })
    ]);

    const caixa = await firstValueFrom(service.caixaAtual$);
    const saidas = await firstValueFrom(service.saidasConfirmadas$);

    expect(caixa).toBe(-80);
    expect(saidas).toBe(80);
  });

  it('ignora pendente no caixa e considera no projetado', async () => {
    const now = new Date();
    const vencimento = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 9, 0);
    lancamentosSubject.next([
      buildLancamento({
        id: 'l3',
        valor: 400,
        data_vencimento: vencimento,
        status: 'PENDENTE',
        tipo: 'ENTRADA'
      })
    ]);

    const caixa = await firstValueFrom(service.caixaAtual$);
    const projetado = await firstValueFrom(service.saldoProjetado$);

    expect(caixa).toBe(0);
    expect(projetado).toBe(400);
  });

  it('não considera estorno como confirmado ou pendente', async () => {
    const now = new Date(2024, 6, 3, 16, 0);
    lancamentosSubject.next([
      buildLancamento({
        id: 'l4',
        valor: 120,
        data_vencimento: now,
        data_pagamento: now,
        status: 'ESTORNADO',
        tipo: 'ENTRADA'
      })
    ]);

    const caixa = await firstValueFrom(service.caixaAtual$);
    const projetado = await firstValueFrom(service.saldoProjetado$);

    expect(caixa).toBe(0);
    expect(projetado).toBe(0);
  });

  it('calcula resultado por competência no mês corrente', async () => {
    const now = new Date();
    const competenciaAtual = new Date(now.getFullYear(), now.getMonth(), 5, 12, 0);
    const competenciaAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 20, 12, 0);

    lancamentosSubject.next([
      buildLancamento({
        id: 'l5',
        valor: 1500,
        data_vencimento: competenciaAtual,
        data_pagamento: now,
        status: 'CONFIRMADO',
        tipo: 'ENTRADA'
      }),
      buildLancamento({
        id: 'l6',
        valor: 450,
        data_vencimento: competenciaAtual,
        data_pagamento: now,
        status: 'PAGO',
        tipo: 'SAIDA'
      }),
      buildLancamento({
        id: 'l7',
        valor: 600,
        data_vencimento: competenciaAnterior,
        data_pagamento: competenciaAnterior,
        status: 'CONFIRMADO',
        tipo: 'ENTRADA'
      })
    ]);

    const resultado = await firstValueFrom(service.resultadoPeriodo$);

    expect(resultado).toBe(1050);
  });

  describe('cenarios financeiros', () => {
    describe('cenario 1 - pagamento parcial', () => {
      it('calcula metricas', async () => {
        lancamentosSubject.next([
          buildLancamento({
            id: 'c1-1',
            valor: 400,
            data_vencimento: makeDate(2026, 2, 5),
            data_pagamento: makeDate(2026, 2, 10),
            status: 'CONFIRMADO',
            tipo: 'ENTRADA'
          }),
          buildLancamento({
            id: 'c1-2',
            valor: 600,
            data_vencimento: makeDate(2026, 2, 25),
            status: 'PENDENTE',
            tipo: 'ENTRADA'
          })
        ]);

        await expectMetrics({
          caixaAtual: 400,
          entradas: 400,
          saidas: 0,
          resultadoCompetencia: 400,
          saldoProjetado: 1000
        });
      });
    });

    describe('cenario 2 - estorno total', () => {
      it('calcula metricas', async () => {
        lancamentosSubject.next([
          buildLancamento({
            id: 'c2-1',
            valor: 800,
            data_vencimento: makeDate(2026, 2, 1),
            data_pagamento: makeDate(2026, 2, 2),
            status: 'ESTORNADO',
            tipo: 'ENTRADA'
          })
        ]);

        await expectMetrics({
          caixaAtual: 0,
          entradas: 0,
          saidas: 0,
          resultadoCompetencia: 0,
          saldoProjetado: 0
        });
      });
    });

    describe('cenario 3 - estorno parcial', () => {
      it('calcula metricas', async () => {
        lancamentosSubject.next([
          buildLancamento({
            id: 'c3-1',
            valor: 1200,
            data_vencimento: makeDate(2026, 2, 3),
            data_pagamento: makeDate(2026, 2, 5),
            status: 'CONFIRMADO',
            tipo: 'ENTRADA'
          }),
          buildLancamento({
            id: 'c3-2',
            valor: 300,
            data_vencimento: makeDate(2026, 2, 10),
            data_pagamento: makeDate(2026, 2, 11),
            status: 'PAGO',
            tipo: 'SAIDA'
          })
        ]);

        await expectMetrics({
          caixaAtual: 900,
          entradas: 1200,
          saidas: 300,
          resultadoCompetencia: 900,
          saldoProjetado: 900
        });
      });
    });

    describe('cenario 4 - cancelamento apos pagamento', () => {
      it('calcula metricas', async () => {
        lancamentosSubject.next([
          buildLancamento({
            id: 'c4-1',
            valor: 500,
            data_vencimento: makeDate(2026, 2, 4),
            data_pagamento: makeDate(2026, 2, 5),
            status: 'CANCELADO',
            tipo: 'ENTRADA'
          })
        ]);

        await expectMetrics({
          caixaAtual: 0,
          entradas: 0,
          saidas: 0,
          resultadoCompetencia: 0,
          saldoProjetado: 0
        });
      });
    });

    describe('cenario 5 - competencia diferente do pagamento', () => {
      it('calcula metricas', async () => {
        lancamentosSubject.next([
          buildLancamento({
            id: 'c5-1',
            valor: 1000,
            data_vencimento: makeDate(2026, 2, 10),
            data_pagamento: makeDate(2026, 3, 5),
            status: 'CONFIRMADO',
            tipo: 'ENTRADA'
          }),
          buildLancamento({
            id: 'c5-2',
            valor: 200,
            data_vencimento: makeDate(2026, 2, 2),
            data_pagamento: makeDate(2026, 2, 7),
            status: 'PAGO',
            tipo: 'SAIDA'
          })
        ]);

        await expectMetrics({
          caixaAtual: 800,
          entradas: 1000,
          saidas: 200,
          resultadoCompetencia: 800,
          saldoProjetado: 800
        });
      });
    });

    describe('cenario 6 - despesas futuras', () => {
      it('calcula metricas', async () => {
        lancamentosSubject.next([
          buildLancamento({
            id: 'c6-1',
            valor: 700,
            data_vencimento: makeDate(2026, 3, 5),
            status: 'PENDENTE',
            tipo: 'SAIDA'
          })
        ]);

        await expectMetrics({
          caixaAtual: 0,
          entradas: 0,
          saidas: 0,
          resultadoCompetencia: 0,
          saldoProjetado: -700
        });
      });
    });

    describe('cenario 7 - OS nunca paga', () => {
      it('calcula metricas', async () => {
        lancamentosSubject.next([
          buildLancamento({
            id: 'c7-1',
            valor: 900,
            data_vencimento: makeDate(2026, 2, 25),
            status: 'PENDENTE',
            tipo: 'ENTRADA'
          })
        ]);

        await expectMetrics({
          caixaAtual: 0,
          entradas: 0,
          saidas: 0,
          resultadoCompetencia: 0,
          saldoProjetado: 900
        });
      });
    });

    describe('cenario 8 - mix com despesa futura', () => {
      it('calcula metricas', async () => {
        lancamentosSubject.next([
          buildLancamento({
            id: 'c8-1',
            valor: 1500,
            data_vencimento: makeDate(2026, 2, 1),
            data_pagamento: makeDate(2026, 2, 3),
            status: 'CONFIRMADO',
            tipo: 'ENTRADA'
          }),
          buildLancamento({
            id: 'c8-2',
            valor: 600,
            data_vencimento: makeDate(2026, 2, 2),
            data_pagamento: makeDate(2026, 2, 4),
            status: 'PAGO',
            tipo: 'SAIDA'
          }),
          buildLancamento({
            id: 'c8-3',
            valor: 200,
            data_vencimento: makeDate(2026, 2, 25),
            status: 'PENDENTE',
            tipo: 'SAIDA'
          })
        ]);

        await expectMetrics({
          caixaAtual: 900,
          entradas: 1500,
          saidas: 600,
          resultadoCompetencia: 900,
          saldoProjetado: 700
        });
      });
    });

    describe('cenario 9 - entrada pendente grande', () => {
      it('calcula metricas', async () => {
        lancamentosSubject.next([
          buildLancamento({
            id: 'c9-1',
            valor: 2000,
            data_vencimento: makeDate(2026, 2, 25),
            status: 'PENDENTE',
            tipo: 'ENTRADA'
          }),
          buildLancamento({
            id: 'c9-2',
            valor: 500,
            data_vencimento: makeDate(2026, 2, 10),
            data_pagamento: makeDate(2026, 2, 11),
            status: 'PAGO',
            tipo: 'SAIDA'
          })
        ]);

        await expectMetrics({
          caixaAtual: -500,
          entradas: 0,
          saidas: 500,
          resultadoCompetencia: -500,
          saldoProjetado: 1500
        });
      });
    });

    describe('cenario 10 - pagamentos fracionados', () => {
      it('calcula metricas', async () => {
        lancamentosSubject.next([
          buildLancamento({
            id: 'c10-1',
            valor: 300,
            data_vencimento: makeDate(2026, 2, 5),
            data_pagamento: makeDate(2026, 2, 6),
            status: 'CONFIRMADO',
            tipo: 'ENTRADA'
          }),
          buildLancamento({
            id: 'c10-2',
            valor: 700,
            data_vencimento: makeDate(2026, 2, 5),
            data_pagamento: makeDate(2026, 2, 18),
            status: 'RECEBIDO',
            tipo: 'ENTRADA'
          }),
          buildLancamento({
            id: 'c10-3',
            valor: 200,
            data_vencimento: makeDate(2026, 2, 7),
            data_pagamento: makeDate(2026, 2, 7),
            status: 'PAGO',
            tipo: 'SAIDA'
          })
        ]);

        await expectMetrics({
          caixaAtual: 800,
          entradas: 1000,
          saidas: 200,
          resultadoCompetencia: 800,
          saldoProjetado: 800
        });
      });
    });

    describe('cenario 11 - estorno total de despesa', () => {
      it('calcula metricas', async () => {
        lancamentosSubject.next([
          buildLancamento({
            id: 'c11-1',
            valor: 500,
            data_vencimento: makeDate(2026, 2, 2),
            data_pagamento: makeDate(2026, 2, 3),
            status: 'CONFIRMADO',
            tipo: 'ENTRADA'
          }),
          buildLancamento({
            id: 'c11-2',
            valor: 400,
            data_vencimento: makeDate(2026, 2, 2),
            data_pagamento: makeDate(2026, 2, 3),
            status: 'ESTORNADO',
            tipo: 'SAIDA'
          })
        ]);

        await expectMetrics({
          caixaAtual: 500,
          entradas: 500,
          saidas: 0,
          resultadoCompetencia: 500,
          saldoProjetado: 500
        });
      });
    });

    describe('cenario 12 - cancelamento de pendente', () => {
      it('calcula metricas', async () => {
        lancamentosSubject.next([
          buildLancamento({
            id: 'c12-1',
            valor: 600,
            data_vencimento: makeDate(2026, 2, 12),
            status: 'CANCELADO',
            tipo: 'ENTRADA'
          }),
          buildLancamento({
            id: 'c12-2',
            valor: 100,
            data_vencimento: makeDate(2026, 2, 12),
            data_pagamento: makeDate(2026, 2, 12),
            status: 'PAGO',
            tipo: 'SAIDA'
          })
        ]);

        await expectMetrics({
          caixaAtual: -100,
          entradas: 0,
          saidas: 100,
          resultadoCompetencia: -100,
          saldoProjetado: -100
        });
      });
    });

    describe('cenario 13 - competencia anterior e despesa futura', () => {
      it('calcula metricas', async () => {
        lancamentosSubject.next([
          buildLancamento({
            id: 'c13-1',
            valor: 800,
            data_vencimento: makeDate(2026, 1, 30),
            data_pagamento: makeDate(2026, 2, 2),
            status: 'CONFIRMADO',
            tipo: 'ENTRADA'
          }),
          buildLancamento({
            id: 'c13-2',
            valor: 300,
            data_vencimento: makeDate(2026, 3, 5),
            status: 'PENDENTE',
            tipo: 'SAIDA'
          })
        ]);

        await expectMetrics({
          caixaAtual: 800,
          entradas: 800,
          saidas: 0,
          resultadoCompetencia: 0,
          saldoProjetado: 500
        });
      });
    });

    describe('cenario 14 - parcial com despesa confirmada', () => {
      it('calcula metricas', async () => {
        lancamentosSubject.next([
          buildLancamento({
            id: 'c14-1',
            valor: 400,
            data_vencimento: makeDate(2026, 2, 14),
            data_pagamento: makeDate(2026, 2, 15),
            status: 'CONFIRMADO',
            tipo: 'ENTRADA'
          }),
          buildLancamento({
            id: 'c14-2',
            valor: 600,
            data_vencimento: makeDate(2026, 2, 25),
            status: 'PENDENTE',
            tipo: 'ENTRADA'
          }),
          buildLancamento({
            id: 'c14-3',
            valor: 150,
            data_vencimento: makeDate(2026, 2, 16),
            data_pagamento: makeDate(2026, 2, 16),
            status: 'PAGO',
            tipo: 'SAIDA'
          })
        ]);

        await expectMetrics({
          caixaAtual: 250,
          entradas: 400,
          saidas: 150,
          resultadoCompetencia: 250,
          saldoProjetado: 850
        });
      });
    });

    describe('cenario 15 - cruzado com pendente futuro', () => {
      it('calcula metricas', async () => {
        lancamentosSubject.next([
          buildLancamento({
            id: 'c15-1',
            valor: 900,
            data_vencimento: makeDate(2026, 2, 1),
            data_pagamento: makeDate(2026, 2, 1),
            status: 'CONFIRMADO',
            tipo: 'ENTRADA'
          }),
          buildLancamento({
            id: 'c15-2',
            valor: 200,
            data_vencimento: makeDate(2026, 1, 15),
            data_pagamento: makeDate(2026, 2, 5),
            status: 'PAGO',
            tipo: 'SAIDA'
          }),
          buildLancamento({
            id: 'c15-3',
            valor: 500,
            data_vencimento: makeDate(2026, 3, 1),
            status: 'PENDENTE',
            tipo: 'ENTRADA'
          })
        ]);

        await expectMetrics({
          caixaAtual: 700,
          entradas: 900,
          saidas: 200,
          resultadoCompetencia: 900,
          saldoProjetado: 1200
        });
      });
    });
  });
});
