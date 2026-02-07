## Solaris Financeiro — Contrato e Arquitetura Definitiva

### 1. Regra de Negócio Imutável
- **OS Operacional:** `ABERTA → EM_ANDAMENTO → CONCLUIDA`, com terminal `CANCELADA`.
- **OS Financeiro:** `SEM_LANCAMENTO`, `EM_ABERTO`, `QUITADO`, `ESTORNADO/CANCELADO`.
- **Lançamentos:** estados `PENDENTE`, `CONFIRMADO/RECEBIDO/PAGO`, `CANCELADO`, `ESTORNADO`.
- **Transições Válidas:** `PENDENTE→CONFIRMADO`, `PENDENTE→CANCELADO`, `CONFIRMADO→ESTORNADO`, `CONFIRMADO→CANCELADO (auditoria)`.
- **Eventos Obrigatórios:** concluir OS, pagar/receber, cancelar, estornar (registrados em audit).
- **Competência vs Caixa:** Competência usa `dataCompetencia`; Caixa usa `dataPagamento`.
- **Fonte de Verdade:** `empresas/{empresaId}/lancamentosFinanceiros`.
- **Imutabilidade:** valores confirmados só mudam via estorno + novo lançamento.

### 2. Cenários Extremados (referência 20/02/2026)
**Premissas:** valores em R$, caixa considera apenas lançamentos confirmados até 20/02/2026, saldo projetado = caixa + pendentes.
| # | Situação | Datas-chave (competência/pagamento/evento) | Caixa | Entradas | Saídas | Resultado Comp | Saldo Proj |
|---|----------|-------------------------------------------|-------|----------|--------|----------------|------------|
|1|Pagamento parcial|Comp 10/02; pago 15/02 (R$400); pendente 05/03 (R$600)|400|400|0|400|1000|
|2|Estorno total|Comp 05/02; pago 06/02 (R$800); estorno 18/02 (-R$800)|0|800|800|0|0|
|3|Estorno parcial|Comp 01/02; pago 02/02 (R$1200); estorno 11/02 (-R$300)|900|1200|300|900|900|
|4|Cancelamento após pagamento|Comp 03/02; pago 04/02 (R$500); cancelado 12/02|0|500|500|0|0|
|5|Competência ≠ pagamento|Comp 28/01; pago 05/02 (R$1000)|1000|1000|0|1000|1000|
|6|Despesa futura|Comp 10/03; venc 10/03 (R$700); sem pagamento|0|0|0|0|-700|
|7|OS nunca paga|Comp 15/02 (R$900); sem pagamento|0|0|0|0|900|
|8|Mix + despesa futura|Entradas pagas 05/02 (R$1500); saída paga 07/02 (R$600); saída pendente 05/03 (R$200)|900|1500|600|900|700|
|9|Entrada pendente grande|Entrada pendente 25/02 (R$2000); saída paga 12/02 (R$500)|-500|0|500|-500|1500|
|10|Pagamentos fracionados|Comp 01/02 (R$900); pagos 05/02 (R$300) e 15/02 (R$300); pendente 05/03 (R$300)|600|600|0|600|900|
|11|Estorno de despesa|Saída paga 03/02 (R$500); estorno 10/02 (+R$500)|0|500|500|0|0|
|12|Cancelamento pendente|Saída pendente 05/02 (R$100); cancelada 08/02|0|0|0|0|0|
|13|Comp. anterior + pagamento futuro|Comp 20/01 (R$800); pagamento previsto 25/02|0|0|0|0|800|
|14|Parcial + despesa confirmada|Entrada paga 10/02 (R$400); saída paga 11/02 (R$150); pendente 12/02 (R$600)|250|400|150|250|850|
|15|Cruzado + pendentes futuros|Entrada paga 05/02 (R$900); saída paga 06/02 (R$200); entrada pendente 20/03 (R$800); saída pendente 20/03 (R$300)|700|900|200|700|1200|

### 3. Firestore Definitivo
- **Multi-tenant:** raiz `empresas/{empresaId}`; usuários em `/users/{uid}` com `tenantId` (empresaId) para isolamento.
- **Subcollections principais:** `os`, `lancamentosFinanceiros`, `financeiro_mensal`, `auditEvents`, `_aggregate_events`.
- **Relacionamentos:**  
  - `os/{osId}` → `lancamentosFinanceiros` via `id_os` e `origem`.  
  - `lancamentosFinanceiros` referencia `clienteId` e `usuarioId` (denormalizado para leitura rápida).  
  - `financeiro_mensal/{YYYY-MM}` agrega somente lançamentos confirmados por `dataCompetencia`.
- **Documento `lancamentosFinanceiros`:** obrigatórios (`empresaId`, `valor`, `tipo`, `status`, `dataCompetencia`, `createdAt`, `origem`, `usuarioId`), opcionais (`dataPagamento`, `categoria`, `metodo_pagamento`, `descricao`, `id_os`, dados de cliente).
- **`financeiro_mensal/{YYYY-MM}`:** `monthKey`, `year`, `month`, `totals.{entradas,saidas,saldo}`, `updatedAt`, `updatedByEventId`.
- **Índices necessários:**  
  - `empresaId + status + dataCompetencia`  
  - `empresaId + tipo + status + dataCompetencia`  
  - `empresaId + status + dataPagamento`  
  - `empresaId + id_os + status`
- **Boas práticas de escalabilidade:** paginação, limites por consulta, evitar scans completos, denormalização controlada, agregação incremental por evento, uso de `_aggregate_events` para idempotência.

### 4. Regras de Segurança (Firestore)
```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }
    function getUid() {
      return request.auth.uid;
    }
    function getTenantId() {
      return get(/databases/$(database)/documents/users/$(getUid())).data.tenantId;
    }
    function isAdmin() {
      return get(/databases/$(database)/documents/users/$(getUid())).data.role == 'admin';
    }

    match /empresas/{empresaId} {
      allow read, write: if false;

      match /financeiro_mensal/{monthId} {
        allow read: if isAuthenticated() && getTenantId() == empresaId;
        allow write: if false; // somente backend (Admin SDK)
      }

      match /auditEvents/{eventId} {
        allow read: if isAuthenticated() && getTenantId() == empresaId && isAdmin();
        allow write: if false; // somente backend (Admin SDK)
      }

      match /_aggregate_events/{docId} {
        allow read, write: if false; // somente backend (Admin SDK)
      }

      match /lancamentosFinanceiros/{lancamentoId} {
        allow read: if isAuthenticated() && getTenantId() == empresaId;
        allow create: if isAuthenticated()
          && getTenantId() == empresaId
          && request.resource.data.empresaId == empresaId
          && request.resource.data.status == 'PENDENTE';
        allow update: if isAuthenticated()
          && getTenantId() == empresaId
          && resource.data.empresaId == empresaId
          && request.resource.data.empresaId == empresaId
          && resource.data.status == 'PENDENTE'
          && request.resource.data.status == 'PENDENTE' // cliente não confirma
          && request.resource.data.valor == resource.data.valor
          && request.resource.data.tipo == resource.data.tipo
          && request.resource.data.dataCompetencia == resource.data.dataCompetencia;
        allow delete: if false;
      }

      match /os/{osId} {
        allow read, write: if isAuthenticated() && getTenantId() == empresaId;
      }
    }
  }
}
```

### 5. Cloud Functions de Eventos
- `onOsConcluida`: cria lançamentos pendentes quando OS muda para `CONCLUIDA`.
- `confirmarPagamento`: transação confirma lançamento e registra auditoria.
- `estornarLancamento`: cria estorno vinculado e ajusta original.
- `cancelarLancamentoPendente`: marca pendentes como cancelados ao cancelar OS.
- Todas usam transações, registram `eventId` em `_aggregate_events`, e log estruturado.

### 6. Pré-Agregação Mensal
- Trigger `onWrite` em `lancamentosFinanceiros`.
- Calcula deltas por `dataCompetencia` apenas para confirmados.
- Aplica `FieldValue.increment` em `financeiro_mensal/{monthKey}` dentro de transação.
- Idempotência via `_aggregate_events`.
- Reconciliação agendada recalcula últimos N meses para consistência.

### 7. Fórmulas Oficiais
- `Caixa = Σ_{confirmados,dataPag≤ref} (+/- valor)`.
- `Entradas = Σ_{confirmados, tipo=ENTRADA, dataPag≤ref} valor`.
- `Saídas = Σ_{confirmados, tipo=SAIDA, dataPag≤ref} valor`.
- `Resultado competência (mês) = Σ_{confirmados, dataComp∈mês} (+/- valor)`.
- `Saldo projetado = Caixa + Σ_{pendentes} (+/- valor)`.
- `Ticket médio = Σ entradas confirmadas / #entradas confirmadas`.
- `Conversão OS = #OS com lançamentos confirmados / #OS emitidas`.

### 8. Auditoria
- Coleção `auditEvents` (append-only) com antes/depois, usuário, origem, refs.
- Escrita apenas por backend/Cloud Functions.
- Logs também no Cloud Logging; alertas opcionais.

### 9. Arquitetura Angular
- Services centralizados (FinanceiroService, DashboardMetricsService etc.).
- Observables com `shareReplay`, componentes usando `async` pipe.
- `ChangeDetectionStrategy.OnPush` em todas as telas.
- Componentes só formatam/exibem; cálculos sempre nos services.

### 10. Tela Financeiro Ideal
- Seções: Caixa Atual, Projeção, Resultado (DRE), Indicadores.
- Gráficos apenas onde agregados acrescentam valor (ex.: Realizado vs Meta).
- Mobile usa acordeões; filtros de período globais.

### 11. Dashboard Estratégico
- KPIs principais + delta vs mês anterior.
- Comparativos (Entradas vs Saídas, Realizado vs Meta).
- Tendências (últimos 6 meses) e ranking (clientes/serviços).

### 12. Performance
- Leitura padrão via `financeiro_mensal`; fallback only quando necessário.
- Cache em services e armazenamento local.
- Paginação e queries com índices, sem listar coleções inteiras.

### 13. Pagamentos Parciais/Múltiplos
- Cada parcela = lançamento individual com `parcelaDe`.
- Múltiplas formas e taxas registradas por lançamento.
- Parcelamentos distribuem `dataCompetencia`; antecipações geram lançamentos extras (entradas + saídas taxa).

### 14. Modelo SaaS
- `plan` em `empresas`, limites por plano aplicados em Cloud Functions.
- Usuário pode ter múltiplas empresas (contexto switch).
- Billing via Stripe/Asaas; webhook atualiza plano/estado.

### 15. Checklist Produção
1. `npm run lint && npm run test && npm run build`.
2. `npm --prefix functions run build && firebase deploy --only functions`.
3. `firebase deploy --only firestore:rules` + índices.
4. Validar cenários críticos (parcial, estorno, cancelamento).
5. Monitorar performance (leituras, agregados).
6. Testar regras no Emulator.
7. Auditar Cloud Logging + alertas.

