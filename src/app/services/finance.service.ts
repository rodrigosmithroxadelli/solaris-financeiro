import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, addDoc, doc, deleteDoc, query, orderBy, updateDoc, collectionData } from '@angular/fire/firestore';
import { Observable, shareReplay } from 'rxjs';
import { map } from 'rxjs/operators';
import { Transaction } from '../models/transaction.model';

export interface PeriodSummary {
  totalEntradas: number;
  totalSaidas: number;
  saldo: number;
  date: string;
}

export interface CashFlowSummary {
  entradas: number;
  saidas: number;
  saldo: number;
}

@Injectable({
  providedIn: 'root'
})
export class FinanceService {
  private firestore: Firestore = inject(Firestore); // Injeta o banco de dados
  private environmentInjector = inject(EnvironmentInjector);
  private transactionsCollection = runInInjectionContext(this.environmentInjector, () =>
    collection(this.firestore, 'lancamentos')
  ); // Define a pasta "lancamentos"
  // LISTAR (Ouvido Bionico)
  // Essa variável fica "escutando" o banco. Se mudar lá, muda aqui na hora.
  transactions$: Observable<Transaction[]> = runInInjectionContext(this.environmentInjector, () =>
    collectionData(
      query(this.transactionsCollection, orderBy('date', 'desc')),
      { idField: 'id' }
    ) as Observable<Transaction[]>
  ).pipe(shareReplay({ bufferSize: 1, refCount: false }));

  normalizePaymentStatus(status?: Transaction['paymentStatus']): Transaction['paymentStatus'] {
    return status ?? 'PAGO';
  }

  filterPaidTransactions(transactions: Transaction[]): Transaction[] {
    return transactions.filter(transaction => this.normalizePaymentStatus(transaction.paymentStatus) === 'PAGO');
  }

  filterPendingEntries(transactions: Transaction[]): Transaction[] {
    return transactions.filter(transaction =>
      transaction.type === 'entrada' && this.normalizePaymentStatus(transaction.paymentStatus) === 'PENDENTE'
    );
  }

  getPaidTransactions(): Observable<Transaction[]> {
    return this.transactions$.pipe(
      map(transactions => this.filterPaidTransactions(transactions))
    );
  }

  // ADICIONAR (Salvar na Nuvem)
  async addTransaction(transaction: Transaction) {
    // Removemos o ID manual porque o Firebase cria um automático e seguro
    const { id, ...data } = transaction; 
    await runInInjectionContext(this.environmentInjector, () =>
      addDoc(this.transactionsCollection, data)
    );
  }

  // ATUALIZAR
  async updateTransaction(id: string, transaction: Partial<Transaction>) {
    const docRef = runInInjectionContext(this.environmentInjector, () =>
      doc(this.firestore, `lancamentos/${id}`)
    );
    await runInInjectionContext(this.environmentInjector, () =>
      updateDoc(docRef, transaction)
    );
  }

  // APAGAR (Deletar da Nuvem)
  async removeTransaction(id: string) {
    const docRef = runInInjectionContext(this.environmentInjector, () =>
      doc(this.firestore, `lancamentos/${id}`)
    );
    await runInInjectionContext(this.environmentInjector, () =>
      deleteDoc(docRef)
    );
  }

  // Alias for removeTransaction to fix legacy calls
  async deleteTransaction(id: string) {
    return this.removeTransaction(id);
  }

  // METODOS DE DASHBOARD
  getTransactionsForPeriod(period: 'day' | 'week' | 'month', date: Date = new Date()): Observable<Transaction[]> {
    return this.transactions$.pipe(
      map(transactions => {
        const targetDate = new Date(date);
        let startDate: Date;
        let endDate: Date;

        targetDate.setHours(0, 0, 0, 0); // Reset time for accurate comparison

        if (period === 'day') {
          startDate = new Date(targetDate);
          endDate = new Date(targetDate);
          endDate.setHours(23, 59, 59, 999);
        } else if (period === 'week') {
          const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 6 = Saturday
          startDate = new Date(targetDate);
          startDate.setDate(targetDate.getDate() - dayOfWeek); // Start of the current week (Sunday)
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6); // End of the current week (Saturday)
          endDate.setHours(23, 59, 59, 999);
        } else { // month
          startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
          endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0); // Last day of the month
          endDate.setHours(23, 59, 59, 999);
        }

        return transactions.filter(transaction => {
          if (this.normalizePaymentStatus(transaction.paymentStatus) !== 'PAGO') {
            return false;
          }
          const transactionDate = new Date(transaction.date);
          return transactionDate >= startDate && transactionDate <= endDate;
        });
      })
    );
  }

  getSummaryForPeriod(period: 'day' | 'week' | 'month', date: Date = new Date()): Observable<CashFlowSummary> {
    return this.getTransactionsForPeriod(period, date).pipe(
      map(transactions => {
        const entradas = transactions
          .filter(t => t.type === 'entrada')
          .reduce((acc, curr) => acc + curr.amount, 0);
        const saidas = transactions
          .filter(t => t.type === 'saida')
          .reduce((acc, curr) => acc + curr.amount, 0);
        return {
          entradas,
          saidas,
          saldo: entradas - saidas
        };
      })
    );
  }

  getBalanceTotal(): Observable<CashFlowSummary> {
    return this.getPaidTransactions().pipe(
      map(transactions => {
        const entradas = transactions
          .filter(t => t.type === 'entrada')
          .reduce((acc, curr) => acc + curr.amount, 0);
        const saidas = transactions
          .filter(t => t.type === 'saida')
          .reduce((acc, curr) => acc + curr.amount, 0);
        return {
          entradas,
          saidas,
          saldo: entradas - saidas
        };
      })
    );
  }

  // UTILS
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  formatDate(date: string): string {
    if (!date) return '';
    const d = new Date(date);
    // Adiciona o timezone para evitar problemas de data
    const userTimezoneOffset = d.getTimezoneOffset() * 60000;
    const correctedDate = new Date(d.getTime() + userTimezoneOffset);
    return new Intl.DateTimeFormat('pt-BR').format(correctedDate);
  }

  // Pagination removed: load all transactions reactively.
}
