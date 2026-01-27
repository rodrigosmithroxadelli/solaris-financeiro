import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { IonicModule, NavController, ToastController, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonList,
  IonBadge,
  IonFab,
  IonFabButton,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonDatetimeButton,
  IonModal,
  IonDatetime,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonTextarea,
  IonButtons
} from '@ionic/angular/standalone';
import { FinanceService, CashFlowSummary } from '../services/finance.service';
import { Transaction, CATEGORIAS_SOLARIS } from '../models/transaction.model';

import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { add, create, trash, arrowUp, arrowDown, calendar, personCircleOutline, close, checkmark } from 'ionicons/icons';

@Component({
  selector: 'app-caixa',
  templateUrl: 'caixa.page.html',
  styleUrls: ['caixa.page.scss'],
  standalone: true,
  providers: [
    ToastController,
    AlertController
  ],
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonList,
    IonBadge,
    IonFab,
    IonFabButton,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonDatetimeButton,
    IonModal,
    IonDatetime,
    IonSelect,
    IonSelectOption,
    IonInput,
    IonTextarea,
    IonButtons
  ]
})
export class CaixaPage implements OnInit, OnDestroy {
  transactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  summary: CashFlowSummary = { entradas: 0, saidas: 0, saldo: 0 };
  searchTerm: string = '';
  selectedDate: string = '';
  private transactionsSubscription?: Subscription;

  // Properties for the "Add Transaction" modal
  showAddTransactionModal = false;
  type: 'entrada' | 'saida' = 'entrada';
  title: string = '';
  amount: number | null = null;
  category: string = '';
  paymentMethod: 'pix' | 'dinheiro' | 'cartao_credito' | 'cartao_debito' = 'dinheiro';
  date: string = new Date().toISOString();
  description: string = '';
  clientName: string = '';
  clientPhone: string = '';
  clientAddress: string = '';
  categorias = CATEGORIAS_SOLARIS;
  isEditMode: boolean = false;


  constructor(
    public financeService: FinanceService, // Made public to be accessible in the template
    private navCtrl: NavController,
    private toastController: ToastController,
    private alertController: AlertController
  ) {
    addIcons({ add, create, trash, arrowUp, arrowDown, calendar, personCircleOutline, close, checkmark });
  }

  ngOnInit() {
    this.transactionsSubscription = this.financeService.transactions$.subscribe(data => {
      this.transactions = data;
      this.calculateSummary();
      this.applyFilters();
    });
  }

  ngOnDestroy() {
    this.transactionsSubscription?.unsubscribe();
  }

  calculateSummary() {
    const entradas = this.transactions
      .filter(t => t.type === 'entrada')
      .reduce((acc, curr) => acc + curr.amount, 0);
    const saidas = this.transactions
      .filter(t => t.type === 'saida')
      .reduce((acc, curr) => acc + curr.amount, 0);
    this.summary = {
      entradas,
      saidas,
      saldo: entradas - saidas
    };
  }

  // Methods for "Add Transaction" modal
  openAddTransactionModal() {
    this.isEditMode = false;
    this.resetTransactionForm();
    this.showAddTransactionModal = true;
  }

  cancelAddTransaction() {
    this.showAddTransactionModal = false;
  }

  private resetTransactionForm() {
    this.type = 'entrada';
    this.title = '';
    this.amount = null;
    this.category = '';
    this.paymentMethod = 'dinheiro';
    this.date = new Date().toISOString();
    this.description = '';
    this.clientName = '';
    this.clientPhone = '';
    this.clientAddress = '';
  }

  get availableCategories(): string[] {
    return this.type === 'entrada'
      ? this.categorias.entradas
      : this.categorias.saidas;
  }

  readonly paymentMethods = [
    { value: 'pix', label: 'PIX' },
    { value: 'dinheiro', label: 'Dinheiro' },
    { value: 'cartao_credito', label: 'Cartão de Crédito' },
    { value: 'cartao_debito', label: 'Cartão de Débito' },
  ];

  async saveTransaction() {
    // Validações
    if (!this.title || this.title.trim() === '') {
      await this.showToast('Por favor, preencha o título', 'warning');
      return;
    }

    if (!this.amount || this.amount <= 0) {
      await this.showToast('Por favor, informe um valor válido maior que zero', 'warning');
      return;
    }

    if (!this.category || this.category.trim() === '') {
      await this.showToast('Por favor, selecione uma categoria', 'warning');
      return;
    }

    if (!this.date) {
      await this.showToast('Por favor, selecione uma data', 'warning');
      return;
    }

    const transactionData = {
      type: this.type,
      title: this.title.trim(),
      amount: this.amount,
      category: this.category,
      paymentMethod: this.paymentMethod,
      date: this.date,
      description: this.description?.trim() || '',
      clientName: this.clientName?.trim() || '',
      clientPhone: this.clientPhone?.trim() || '',
      clientAddress: this.clientAddress?.trim() || '',
    };

    try {
      await this.financeService.addTransaction(transactionData);
      await this.showToast('Transação adicionada com sucesso!', 'success');
      this.showAddTransactionModal = false;
    } catch (error) {
      await this.showToast('Erro ao salvar transação', 'danger');
    }
  }
  
  async deleteTransaction(transaction: Transaction) {
    if (!transaction.id) return;
    const alert = await this.alertController.create({
      header: 'Confirmar exclusão',
      message: `Deseja realmente excluir "${transaction.title}"?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Excluir',
          role: 'destructive',
          handler: () => {
            if(transaction.id) {
              this.financeService.deleteTransaction(transaction.id);
              this.showToast('Transação excluída com sucesso', 'success');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async refresh(event: any) {
    // The subscription already keeps the data fresh. 
    // We might just re-apply filters if needed or just complete.
    event.target.complete();
  }

  onSearchChange(event: any) {
    this.searchTerm = event.detail.value;
    this.applyFilters();
  }

  onDateChange(event: any) {
    this.selectedDate = event.detail.value;
    this.applyFilters();
  }

  clearDateFilter() {
    this.selectedDate = '';
    this.applyFilters();
  }

  applyFilters() {
    let filtered = [...this.transactions];

    // Filtro por busca
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(term) ||
        (t.category && t.category.toLowerCase().includes(term)) ||
        (t.description && t.description.toLowerCase().includes(term)) ||
        (t.clientName && t.clientName.toLowerCase().includes(term))
      );
    }

    // Filtro por data
    if (this.selectedDate) {
      const selected = new Date(this.selectedDate);
      const startOfDay = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), 0, 0, 0);
      const endOfDay = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), 23, 59, 59, 999);

      filtered = filtered.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= startOfDay && transactionDate <= endOfDay;
      });
    }

    // Ordenar por data (mais recente primeiro)
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    this.filteredTransactions = filtered;
  }

  getTransactionIcon(type: string): string {
    return type === 'entrada' ? 'arrow-up' : 'arrow-down';
  }

  getTransactionColor(type: string): string {
    return type === 'entrada' ? 'success' : 'danger';
  }

  formatCurrency(value: number): string {
    return this.financeService.formatCurrency(value);
  }

  formatDate(date: string): string {
    return this.financeService.formatDate(date);
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'top'
    });
    await toast.present();
  }
}