import { Injectable } from '@angular/core';
import { User } from '../models/user.model';
import { Transaction } from '../models/transaction.model';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly USERS_KEY = 'solaris_users';
  private readonly TRANSACTIONS_KEY = 'solaris_transactions';
  private readonly CURRENT_USER_KEY = 'solaris_current_user';

  // ========== USUÁRIOS ==========
  getUsers(): User[] {
    const data = localStorage.getItem(this.USERS_KEY);
    return data ? JSON.parse(data) : [];
  }

  saveUsers(users: User[]): void {
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
  }

  addUser(user: User): void {
    const users = this.getUsers();
    users.push(user);
    this.saveUsers(users);
  }

  updateUser(userId: string, updatedUser: Partial<User>): void {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index !== -1) {
      users[index] = { ...users[index], ...updatedUser };
      this.saveUsers(users);
    }
  }

  deleteUser(userId: string): void {
    const users = this.getUsers().filter(u => u.id !== userId);
    this.saveUsers(users);
  }

  // ========== TRANSAÇÕES ==========
  getTransactions(): Transaction[] {
    const data = localStorage.getItem(this.TRANSACTIONS_KEY);
    return data ? JSON.parse(data) : [];
  }

  saveTransactions(transactions: Transaction[]): void {
    localStorage.setItem(this.TRANSACTIONS_KEY, JSON.stringify(transactions));
  }

  addTransaction(transaction: Transaction): void {
    const transactions = this.getTransactions();
    transactions.push(transaction);
    this.saveTransactions(transactions);
  }

  updateTransaction(transactionId: string, updatedTransaction: Partial<Transaction>): void {
    const transactions = this.getTransactions();
    const index = transactions.findIndex(t => t.id === transactionId);
    if (index !== -1) {
      transactions[index] = { ...transactions[index], ...updatedTransaction };
      this.saveTransactions(transactions);
    }
  }

  deleteTransaction(transactionId: string): void {
    const transactions = this.getTransactions().filter(t => t.id !== transactionId);
    this.saveTransactions(transactions);
  }

  // ========== SESSÃO ==========
  setCurrentUser(user: User | null): void {
    if (user) {
      localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(this.CURRENT_USER_KEY);
    }
  }

  getCurrentUser(): User | null {
    const data = localStorage.getItem(this.CURRENT_USER_KEY);
    return data ? JSON.parse(data) : null;
  }

  clearAll(): void {
    localStorage.removeItem(this.CURRENT_USER_KEY);
    // Não limpar usuários e transações aqui - apenas a sessão
  }

  // ========== INICIALIZAÇÃO ==========
  initializeDefaultAdmin(): void {
    const users = this.getUsers();
    if (users.length === 0) {
      const admin: User = {
        id: this.generateId(),
        email: 'admin@solaris.com', // Use email
        tenantId: 'default_tenant', // Placeholder tenantId for local admin
        displayName: 'Administrador', // Use displayName
        role: 'admin',
        createdAt: new Date().toISOString()
      };
      // Password is not stored directly in the User model in local storage
      // For authentication, this would rely on AuthService
      this.addUser(admin);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
