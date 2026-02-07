import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

admin.initializeApp();

const COLLECTIONS = {
  EMPRESAS: 'empresas',
  OS: 'os',
  LANCAMENTOS: 'lancamentosFinanceiros',
  AUDIT: 'auditEvents',
  AGGREGATE_EVENTS: '_aggregate_events',
  FINANCEIRO_MENSAL: 'financeiro_mensal'
} as const;

const LANCAMENTO_STATUS = {
  PENDENTE: 'PENDENTE',
  CONFIRMADO: 'CONFIRMADO',
  RECEBIDO: 'RECEBIDO',
  PAGO: 'PAGO',
  CANCELADO: 'CANCELADO',
  ESTORNADO: 'ESTORNADO'
} as const;

const CONFIRMED_STATUSES = new Set<string>([
  LANCAMENTO_STATUS.CONFIRMADO,
  LANCAMENTO_STATUS.RECEBIDO,
  LANCAMENTO_STATUS.PAGO
]);

type FirestoreDateLike = admin.firestore.Timestamp | Date | string | number | null | undefined;

type LancamentoFinanceiro = {
  id?: string;
  status?: string;
  tipo?: string;
  valor?: number;
  dataCompetencia?: FirestoreDateLike;
  data_vencimento?: FirestoreDateLike;
  dataPagamento?: FirestoreDateLike;
  data_pagamento?: FirestoreDateLike;
  metodo_pagamento?: string;
  empresaId?: string;
  id_os?: string;
  origem?: string;
  descricao?: string;
  categoria?: string;
  cliente_nome?: string;
  cliente_telefone?: string;
  estornoLancamentoId?: string;
  estornadoEm?: FirestoreDateLike;
  estornadoPor?: string;
  estornoMotivo?: string;
};

type Effect = {
  monthId: string;
  entradas: number;
  saidas: number;
};

type LancamentoFromOs = {
  valor?: number;
  tipo?: string;
  dataCompetencia?: FirestoreDateLike;
  dataVencimento?: FirestoreDateLike;
  descricao?: string;
  categoria?: string;
  metodo_pagamento?: string;
};

type NormalizedLancamentoFromOs = {
  valor: number;
  tipo: 'ENTRADA' | 'SAIDA';
  dataCompetencia: Date;
  dataVencimento: Date;
  descricao: string;
  categoria?: string;
  metodo_pagamento?: string;
};

const db = admin.firestore();

// ---------------------------------------------------------------------------
// Cloud Functions - Eventos Financeiros
// ---------------------------------------------------------------------------

export const onOrderStatusChange = functions.firestore
  .document(`${COLLECTIONS.EMPRESAS}/{empresaId}/${COLLECTIONS.OS}/{osId}`)
  .onWrite(async (change, context) => {
    if (!change.after.exists) {
      return null;
    }

    const beforeStatus = change.before.data()?.status;
    const afterStatus = change.after.data()?.status;
    if (afterStatus !== 'CONCLUIDA' || beforeStatus === 'CONCLUIDA') {
      return null;
    }

    const empresaId = String(context.params.empresaId);
    const osId = String(context.params.osId);
    const empresaRef = getEmpresaRef(empresaId);
    const aggregateEventRef = empresaRef.collection(COLLECTIONS.AGGREGATE_EVENTS).doc(context.eventId);

    await db.runTransaction(async transaction => {
      const processedSnap = await transaction.get(aggregateEventRef);
      if (processedSnap.exists) {
        return;
      }

      const osSnap = await transaction.get(change.after.ref);
      const osData = osSnap.data() as ServiceOrderData | undefined;
      const normalizedLancamentos = normalizeLancamentosFromOS(osData, osId);

      if (!normalizedLancamentos.length) {
        transaction.update(change.after.ref, {
          financeiroLancamentosStatus: 'IGNORED',
          financeiroLancamentosUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        transaction.set(aggregateEventRef, {
          type: 'OS_LANCAMENTOS_SKIP',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          osId
        });
        return;
      }

      const lancamentosCollection = empresaRef.collection(COLLECTIONS.LANCAMENTOS);
      const timestamp = admin.firestore.FieldValue.serverTimestamp();

      normalizedLancamentos.forEach(payload => {
        const docRef = lancamentosCollection.doc();
        transaction.set(docRef, {
          id: docRef.id,
          empresaId,
          id_os: osId,
          valor: payload.valor,
          tipo: payload.tipo,
          status: LANCAMENTO_STATUS.PENDENTE,
          dataCompetencia: admin.firestore.Timestamp.fromDate(payload.dataCompetencia),
          data_vencimento: admin.firestore.Timestamp.fromDate(payload.dataVencimento),
          data_pagamento: null,
          dataPagamento: null,
          descricao: payload.descricao,
          categoria: payload.categoria ?? null,
          metodo_pagamento: payload.metodo_pagamento ?? null,
          origem: 'OS',
          cliente_nome: osData?.cliente_nome ?? null,
          cliente_telefone: osData?.cliente_telefone ?? null,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      });

      transaction.update(change.after.ref, {
        financeiroLancamentosStatus: 'GERADOS',
        financeiroLancamentosCount: normalizedLancamentos.length,
        financeiroLancamentosUpdatedAt: timestamp
      });

      registerAuditEvent(transaction, empresaId, {
        eventType: 'OS_LANCAMENTOS_GERADOS',
        osId,
        itens: normalizedLancamentos.length
      });

      transaction.set(aggregateEventRef, {
        type: 'OS_LANCAMENTOS_GERADOS',
        createdAt: timestamp,
        osId
      });
    });

    functions.logger.info('Lançamentos gerados a partir da OS concluída', { empresaId, osId });
    return null;
  });

export const confirmarLancamento = functions.https.onCall(async (data, context) => {
  const actor = ensureSystemAuth(context);
  const { empresaId, lancamentoId, dataPagamento, metodoPagamento, usuarioId, status } = data ?? {};

  if (!empresaId || !lancamentoId) {
    throw new functions.https.HttpsError('invalid-argument', 'empresaId e lancamentoId são obrigatórios.');
  }

  const finalStatus = String(status ?? LANCAMENTO_STATUS.CONFIRMADO).toUpperCase();
  if (!CONFIRMED_STATUSES.has(finalStatus)) {
    throw new functions.https.HttpsError('invalid-argument', 'Status final precisa ser CONFIRMADO, RECEBIDO ou PAGO.');
  }

  const pagamentoDate = toDate(dataPagamento) ?? new Date();

  let alreadyConfirmed = false;
  await db.runTransaction(async transaction => {
    const lancamentoRef = getLancamentoRef(empresaId, lancamentoId);
    const snap = await transaction.get(lancamentoRef);
    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', 'Lançamento não encontrado.');
    }

    const current = snap.data() as LancamentoFinanceiro;
    if (isConfirmedStatus(current.status)) {
      alreadyConfirmed = true;
      return;
    }
    if (!isPendingStatus(current.status)) {
      throw new functions.https.HttpsError('failed-precondition', 'Somente lançamentos pendentes podem ser confirmados.');
    }

    transaction.update(lancamentoRef, {
      status: finalStatus,
      dataPagamento: admin.firestore.Timestamp.fromDate(pagamentoDate),
      data_pagamento: admin.firestore.Timestamp.fromDate(pagamentoDate),
      metodo_pagamento: metodoPagamento ?? current.metodo_pagamento ?? null,
      confirmadoPor: usuarioId ?? actor.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    registerAuditEvent(transaction, empresaId, {
      eventType: 'LANCAMENTO_CONFIRMADO',
      lancamentoId,
      status: finalStatus,
      actor: actor.uid
    });
  });

  return { ok: true, alreadyConfirmed };
});

export const cancelarLancamentoPendente = functions.https.onCall(async (data, context) => {
  const actor = ensureSystemAuth(context);
  const { empresaId, lancamentoId, motivo, usuarioId } = data ?? {};

  if (!empresaId || !lancamentoId) {
    throw new functions.https.HttpsError('invalid-argument', 'empresaId e lancamentoId são obrigatórios.');
  }

  let alreadyCanceled = false;
  await db.runTransaction(async transaction => {
    const lancamentoRef = getLancamentoRef(empresaId, lancamentoId);
    const snap = await transaction.get(lancamentoRef);
    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', 'Lançamento não encontrado.');
    }

    const current = snap.data() as LancamentoFinanceiro;
    if (current.status === LANCAMENTO_STATUS.CANCELADO) {
      alreadyCanceled = true;
      return;
    }
    if (!isPendingStatus(current.status)) {
      throw new functions.https.HttpsError('failed-precondition', 'Somente lançamentos pendentes podem ser cancelados.');
    }

    transaction.update(lancamentoRef, {
      status: LANCAMENTO_STATUS.CANCELADO,
      canceladoPor: usuarioId ?? actor.uid,
      canceladoEm: admin.firestore.FieldValue.serverTimestamp(),
      cancelamentoMotivo: motivo ?? null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    registerAuditEvent(transaction, empresaId, {
      eventType: 'LANCAMENTO_CANCELADO',
      lancamentoId,
      motivo: motivo ?? null,
      actor: actor.uid
    });
  });

  return { ok: true, alreadyCanceled };
});

export const estornarLancamento = functions.https.onCall(async (data, context) => {
  const actor = ensureSystemAuth(context);
  const { empresaId, lancamentoId, motivo, usuarioId, dataEstorno } = data ?? {};

  if (!empresaId || !lancamentoId) {
    throw new functions.https.HttpsError('invalid-argument', 'empresaId e lancamentoId são obrigatórios.');
  }

  let alreadyEstornado = false;
  let estornoLancamentoId: string | null = null;
  await db.runTransaction(async transaction => {
    const lancamentoRef = getLancamentoRef(empresaId, lancamentoId);
    const snap = await transaction.get(lancamentoRef);
    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', 'Lançamento não encontrado.');
    }

    const current = snap.data() as LancamentoFinanceiro;
    if (current.estornoLancamentoId) {
      alreadyEstornado = true;
      estornoLancamentoId = current.estornoLancamentoId;
      return;
    }
    if (!isConfirmedStatus(current.status)) {
      throw new functions.https.HttpsError('failed-precondition', 'Somente lançamentos confirmados podem ser estornados.');
    }

    const valor = Number(current.valor ?? 0);
    if (!Number.isFinite(valor) || valor === 0) {
      throw new functions.https.HttpsError('failed-precondition', 'Valor do lançamento inválido para estorno.');
    }
    const estornoDate = toDate(dataEstorno) ?? new Date();
    const estornoTipo = invertLancamentoTipo(current.tipo);
    const estornoStatus = isConfirmedStatus(current.status) ? current.status : LANCAMENTO_STATUS.CONFIRMADO;
    const estornoRef = getEmpresaRef(empresaId).collection(COLLECTIONS.LANCAMENTOS).doc();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const estornoDescricao = current.descricao ? `Estorno - ${current.descricao}` : `Estorno do lançamento ${lancamentoId}`;

    transaction.set(estornoRef, {
      id: estornoRef.id,
      empresaId,
      id_lancamento_origem: lancamentoId,
      id_os: current.id_os ?? null,
      valor: Math.abs(valor),
      tipo: estornoTipo,
      status: estornoStatus,
      dataCompetencia: admin.firestore.Timestamp.fromDate(estornoDate),
      data_vencimento: admin.firestore.Timestamp.fromDate(estornoDate),
      dataPagamento: admin.firestore.Timestamp.fromDate(estornoDate),
      data_pagamento: admin.firestore.Timestamp.fromDate(estornoDate),
      descricao: estornoDescricao,
      categoria: current.categoria ?? null,
      metodo_pagamento: current.metodo_pagamento ?? null,
      origem: 'ESTORNO',
      cliente_nome: current.cliente_nome ?? null,
      cliente_telefone: current.cliente_telefone ?? null,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    transaction.update(lancamentoRef, {
      estornoLancamentoId: estornoRef.id,
      estornadoPor: usuarioId ?? actor.uid,
      estornadoEm: timestamp,
      estornoMotivo: motivo ?? null,
      updatedAt: timestamp
    });

    registerAuditEvent(transaction, empresaId, {
      eventType: 'LANCAMENTO_ESTORNADO',
      lancamentoId,
      estornoLancamentoId: estornoRef.id,
      motivo: motivo ?? null,
      actor: actor.uid
    });

    estornoLancamentoId = estornoRef.id;
  });

  return { ok: true, alreadyEstornado, estornoLancamentoId };
});

// ---------------------------------------------------------------------------
// Cloud Function - Pré-Agregação Mensal
// ---------------------------------------------------------------------------

export const aggregateFinanceiroMensal = functions.firestore
  .document(`${COLLECTIONS.EMPRESAS}/{empresaId}/${COLLECTIONS.LANCAMENTOS}/{lancamentoId}`)
  .onWrite(async (change, context) => {
    const before = change.before.exists ? (change.before.data() as LancamentoFinanceiro) : null;
    const after = change.after.exists ? (change.after.data() as LancamentoFinanceiro) : null;
    const beforeEffect = buildEffect(before);
    const afterEffect = buildEffect(after);

    if (!beforeEffect && !afterEffect) {
      return null;
    }

    const empresaId = String(context.params.empresaId);
    const eventId = context.eventId;
    const eventRef = getEmpresaRef(empresaId).collection(COLLECTIONS.AGGREGATE_EVENTS).doc(eventId);

    await db.runTransaction(async transaction => {
      const eventSnap = await transaction.get(eventRef);
      if (eventSnap.exists) {
        return;
      }

      if (beforeEffect) {
        applyEffectDelta(transaction, empresaId, beforeEffect, -1);
      }
      if (afterEffect) {
        applyEffectDelta(transaction, empresaId, afterEffect, 1);
      }

      transaction.set(eventRef, {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lancamentoId: context.params.lancamentoId ?? null,
        beforeMonth: beforeEffect?.monthId ?? null,
        afterMonth: afterEffect?.monthId ?? null
      });
    });

    return null;
  });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEffect(data: LancamentoFinanceiro | null): Effect | null {
  if (!data || !isConfirmedStatus(data.status)) {
    return null;
  }

  const competencia = extractCompetenceDate(data);
  if (!competencia) {
    return null;
  }

  const valor = Number(data.valor ?? 0);
  if (!Number.isFinite(valor) || valor === 0) {
    return null;
  }

  const monthId = buildMonthId(competencia);
  const tipo = (data.tipo ?? 'ENTRADA').toUpperCase();
  if (tipo === 'ENTRADA') {
    return { monthId, entradas: valor, saidas: 0 };
  }
  if (tipo === 'SAIDA') {
    return { monthId, entradas: 0, saidas: valor };
  }
  return null;
}

function applyEffectDelta(
  transaction: FirebaseFirestore.Transaction,
  empresaId: string,
  effect: Effect,
  multiplier: 1 | -1
): void {
  const entradasDelta = effect.entradas * multiplier;
  const saidasDelta = effect.saidas * multiplier;
  if (entradasDelta === 0 && saidasDelta === 0) {
    return;
  }

  const [year, month] = effect.monthId.split('-').map(value => Number(value));
  const ref = getEmpresaRef(empresaId).collection(COLLECTIONS.FINANCEIRO_MENSAL).doc(effect.monthId);
  transaction.set(
    ref,
    {
      monthKey: effect.monthId,
      year,
      month,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      'totals.entradas': admin.firestore.FieldValue.increment(entradasDelta),
      'totals.saidas': admin.firestore.FieldValue.increment(saidasDelta),
      'totals.saldo': admin.firestore.FieldValue.increment(entradasDelta - saidasDelta)
    },
    { merge: true }
  );
}

function ensureSystemAuth(context: functions.https.CallableContext): { uid: string } {
  if (!context.auth || !context.auth.token) {
    throw new functions.https.HttpsError('permission-denied', 'Operação permitida apenas para usuários autenticados.');
  }

  const { token, uid } = context.auth;
  const isSystem = token.role === 'system' || token.admin === true;
  if (!isSystem) {
    throw new functions.https.HttpsError('permission-denied', 'Somente o backend está autorizado a executar esta ação.');
  }

  return { uid };
}

function getEmpresaRef(empresaId: string) {
  return db.collection(COLLECTIONS.EMPRESAS).doc(empresaId);
}

function getLancamentoRef(empresaId: string, lancamentoId: string) {
  return getEmpresaRef(empresaId).collection(COLLECTIONS.LANCAMENTOS).doc(lancamentoId);
}

function registerAuditEvent(
  transaction: FirebaseFirestore.Transaction,
  empresaId: string,
  payload: Record<string, unknown>
): void {
  const auditRef = getEmpresaRef(empresaId).collection(COLLECTIONS.AUDIT).doc();
  transaction.set(auditRef, {
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...payload
  });
}

type OsPayment = {
  installments: number;
  netValue: number;
  dueDate: FirestoreDateLike;
  method: string;
};

type ServiceOrderData = {
  id?: string;
  financial?: {
    payments?: OsPayment[];
    totalPrice?: number;
  };
  cliente_nome?: string;
  cliente_telefone?: string;
};

function normalizeLancamentosFromOS(osData: ServiceOrderData | undefined, osId: string): NormalizedLancamentoFromOs[] {
  const allLancamentos: NormalizedLancamentoFromOs[] = [];
  const osFinishDate = new Date(); // A data em que a OS foi concluída

  // Prioriza o array de pagamentos detalhados, que é a estrutura de dados correta.
  if (osData?.financial?.payments && osData.financial.payments.length > 0) {
    for (const payment of osData.financial.payments) {
      const installments = Math.max(1, Number(payment.installments ?? 1));
      const paymentValue = Number(payment.netValue ?? 0);
      if (paymentValue <= 0) {
        continue;
      }

      // Usa a data de vencimento do primeiro pagamento como base.
      const firstDueDate = toDate(payment.dueDate);
      if (!firstDueDate) {
        functions.logger.warn('Pagamento ignorado por falta de data de vencimento', { osId, payment });
        continue;
      }

      const valuePerInstallment = paymentValue / installments;

      for (let i = 0; i < installments; i++) {
        const installmentDate = new Date(firstDueDate);
        // Adiciona meses para as parcelas subsequentes.
        installmentDate.setMonth(installmentDate.getMonth() + i);

        const description = installments > 1
          ? `Parcela ${i + 1}/${installments} da OS #${osId}`
          : `Pagamento da OS #${osId}`;

        allLancamentos.push({
          valor: valuePerInstallment,
          tipo: 'ENTRADA',
          // A competência é a data da conclusão da OS. O vencimento é a data futura.
          dataCompetencia: osFinishDate,
          dataVencimento: installmentDate,
          descricao,
          categoria: 'Venda de Serviço',
          metodo_pagamento: payment.method,
        });
      }
    }
    return allLancamentos;
  }

  // Fallback para o preço total se não houver pagamentos detalhados.
  const total = Number(osData?.financial?.totalPrice ?? 0);
  if (total > 0) {
    allLancamentos.push({
      valor: total,
      tipo: 'ENTRADA',
      dataCompetencia: osFinishDate,
      dataVencimento: osFinishDate,
      descricao: `Recebimento total da OS #${osId}`,
      categoria: 'Venda de Serviço',
    });
  }

  return allLancamentos;
}

function toDate(value: FirestoreDateLike): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate();
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

function extractCompetenceDate(data: LancamentoFinanceiro | null): Date | null {
  if (!data) {
    return null;
  }
  return toDate(data.dataCompetencia) ?? toDate(data.data_vencimento);
}

function buildMonthId(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const paddedMonth = String(month).padStart(2, '0');
  return `${year}-${paddedMonth}`;
}

function invertLancamentoTipo(tipo?: string): 'ENTRADA' | 'SAIDA' {
  const normalized = (tipo ?? 'ENTRADA').toUpperCase();
  return normalized === 'SAIDA' ? 'ENTRADA' : 'SAIDA';
}

function isPendingStatus(status?: string): boolean {
  return status?.toUpperCase() === LANCAMENTO_STATUS.PENDENTE;
}

function isConfirmedStatus(status?: string): boolean {
  if (!status) {
    return false;
  }
  return CONFIRMED_STATUSES.has(status.toUpperCase());
}
