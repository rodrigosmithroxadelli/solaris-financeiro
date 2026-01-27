import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from './storage.service';
import { Transaction } from '../models/transaction.model';

export interface CashFlowSummary {
  totalEntradas: number;
  totalSaidas: number;
  saldo: number;
}

export interface PeriodSummary extends CashFlowSummary {
  period: string; // 'dia' | 'semana' | 'mes'
  date: string;
}

@Injectable({
  providedIn: 'root',
})
export class FinanceService {
  private transactionsSubject = new BehaviorSubject<Transaction[]>([]);
  public transactions$: Observable<Transaction[]> = this.transactionsSubject.asObservable();

  constructor(private storageService: StorageService) {
    this.loadTransactions();
  }

  // ========== TRANSAÇÕES ==========
  private loadTransactions(): void {
    const transactions = this.storageService.getTransactions();
    this.transactionsSubject.next(transactions);
  }

  getAllTransactions(): Transaction[] {
    return this.storageService.getTransactions();
  }

  getTransactionsByDateRange(startDate: string, endDate: string): Transaction[] {
    const transactions = this.getAllTransactions();
    return transactions.filter(t => {
      const transactionDate = new Date(t.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      return transactionDate >= start && transactionDate <= end;
    });
  }

  addTransaction(transaction: Omit<Transaction, 'id'>): Transaction {
    const newTransaction: Transaction = {
      ...transaction,
      id: this.generateId(),
    };
    this.storageService.addTransaction(newTransaction);
    this.loadTransactions();
    return newTransaction;
  }

  updateTransaction(id: string, updates: Partial<Transaction>): void {
    this.storageService.updateTransaction(id, updates);
    this.loadTransactions();
  }

  deleteTransaction(id: string): void {
    this.storageService.deleteTransaction(id);
    this.loadTransactions();
  }

  // ========== CÁLCULOS ==========
  getCashFlowSummary(transactions?: Transaction[]): CashFlowSummary {
    const trans = transactions || this.getAllTransactions();
    
    const totalEntradas = trans
      .filter(t => t.type === 'entrada')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalSaidas = trans
      .filter(t => t.type === 'saida')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      totalEntradas,
      totalSaidas,
      saldo: totalEntradas - totalSaidas,
    };
  }

  getDailySummary(date: string): PeriodSummary {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const transactions = this.getTransactionsByDateRange(
      startDate.toISOString(),
      endDate.toISOString()
    );
    const summary = this.getCashFlowSummary(transactions);

    return {
      ...summary,
      period: 'dia',
      date: date,
    };
  }

  getWeeklySummary(startDate: string): PeriodSummary {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const transactions = this.getTransactionsByDateRange(
      start.toISOString(),
      end.toISOString()
    );
    const summary = this.getCashFlowSummary(transactions);

    return {
      ...summary,
      period: 'semana',
      date: startDate,
    };
  }

  getMonthlySummary(year: number, month: number): PeriodSummary {
    const start = new Date(year, month - 1, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(year, month, 0);
    end.setHours(23, 59, 59, 999);

    const transactions = this.getTransactionsByDateRange(
      start.toISOString(),
      end.toISOString()
    );
    const summary = this.getCashFlowSummary(transactions);

    return {
      ...summary,
      period: 'mes',
      date: `${year}-${month.toString().padStart(2, '0')}`,
    };
  }

  // ========== RELATÓRIOS ==========
  getTransactionsByCategory(type: 'entrada' | 'saida'): { [category: string]: number } {
    const transactions = this.getAllTransactions().filter(t => t.type === type);
    const grouped: { [category: string]: number } = {};

    transactions.forEach(t => {
      grouped[t.category] = (grouped[t.category] || 0) + t.amount;
    });

    return grouped;
  }

  getTransactionsByPaymentMethod(): { [method: string]: number } {
    const transactions = this.getAllTransactions();
    const grouped: { [method: string]: number } = {};

    transactions.forEach(t => {
      grouped[t.paymentMethod] = (grouped[t.paymentMethod] || 0) + t.amount;
    });

    return grouped;
  }

  // ========== UTILITÁRIOS ==========
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('pt-BR');
  }
}
