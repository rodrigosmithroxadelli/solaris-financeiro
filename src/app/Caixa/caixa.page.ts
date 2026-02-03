import { Component, OnInit, OnDestroy, inject, HostListener, DestroyRef } from '@angular/core';
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
  IonItem,
  IonLabel,
  IonList,
  IonBadge,
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
  IonButtons,
  IonToggle
} from '@ionic/angular/standalone';
import { FinanceService, CashFlowSummary } from '../services/finance.service';
import { SalesService } from '../services/sales.service';
import { Transaction, CATEGORIAS_SOLARIS } from '../models/transaction.model';

import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { addIcons } from 'ionicons';
import { add, create, trash, arrowUp, arrowDown, close, checkmark, cashOutline } from 'ionicons/icons';

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
    IonItem,
    IonLabel,
    IonList,
    IonBadge,
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
    IonButtons,
    IonToggle
  ]
})
export class CaixaPage implements OnInit, OnDestroy {
  financeService = inject(FinanceService);
  private salesService = inject(SalesService);
  private navCtrl = inject(NavController);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);
  private destroyRef = inject(DestroyRef);

  transactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  summary: CashFlowSummary = { entradas: 0, saidas: 0, saldo: 0 };
  searchTerm: string = '';
  selectedDate: string = new Date().toISOString();
  onlyEntries = false;
  private transactionsSubscription?: Subscription;

  // Properties for the "Add Transaction" modal
  showAddTransactionModal = false;
  type: 'entrada' | 'saida' = 'entrada';
  title: string = '';
  amount: number | null = null;
  category: string = '';
  paymentMethod: Transaction['paymentMethod'] = 'dinheiro';
  date: string = new Date().toISOString();
  description: string = '';
  clientName: string = '';
  clientPhone: string = '';
  clientAddress: string = '';
  categorias = CATEGORIAS_SOLARIS;
  isEditMode: boolean = false;
  editingTransactionId: string | null = null;


  constructor() {
    addIcons({ add, create, trash, arrowUp, arrowDown, close, checkmark, cashOutline });
  }

  ngOnInit() {
    this.transactionsSubscription = this.financeService.transactions$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => {
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
  openAddTransactionModal(type?: 'entrada' | 'saida') {
    this.isEditMode = false;
    this.resetTransactionForm();
    if (type) {
      this.type = type;
    }
    this.showAddTransactionModal = true;
  }

  openEditTransactionModal(transaction: Transaction) {
    this.isEditMode = true;
    this.editingTransactionId = transaction.id!;
    
    this.type = transaction.type;
    this.title = transaction.title;
    this.amount = transaction.amount;
    this.category = transaction.category;
    this.paymentMethod = transaction.paymentMethod;
    this.date = transaction.date;
    this.description = transaction.description ?? '';
    this.clientName = transaction.clientName || '';
    this.clientPhone = transaction.clientPhone || '';
    this.clientAddress = transaction.clientAddress || '';

    this.showAddTransactionModal = true;
  }

  cancelAddTransaction() {
    this.showAddTransactionModal = false;
    this.editingTransactionId = null;
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
    this.editingTransactionId = null;
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
    { value: 'boleto', label: 'Boleto' },
    { value: 'transferencia', label: 'Transferência' },
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
    if (!this.paymentMethod) {
      await this.showToast('Por favor, selecione um método de pagamento', 'warning');
      return;
    }

    const transactionData: Partial<Transaction> = {
      type: this.type,
      title: this.title.trim(),
      amount: this.amount,
      category: this.category,
      paymentMethod: this.paymentMethod,
      paymentStatus: 'PENDENTE',
      date: this.date,
      description: this.description?.trim() || '',
      clientName: this.clientName?.trim() || '',
      clientPhone: this.clientPhone?.trim() || '',
      clientAddress: this.clientAddress?.trim() || '',
    };

    try {
      if (this.isEditMode && this.editingTransactionId) {
        await this.financeService.updateTransaction(this.editingTransactionId, transactionData);
        await this.showToast('Transação atualizada com sucesso!', 'success');
      } else {
        const saleInput = {
          title: transactionData.title!,
          amount: transactionData.amount!,
          category: transactionData.category!,
          paymentMethod: transactionData.paymentMethod!,
          date: transactionData.date!,
          description: transactionData.description,
          clientName: transactionData.clientName,
          clientPhone: transactionData.clientPhone,
          clientAddress: transactionData.clientAddress
        };
        await new Promise<void>((resolve, reject) => {
          this.salesService.createServiceSale(saleInput).subscribe({
            next: () => resolve(),
            error: (err) => reject(err)
          });
        });
        await this.showToast('Venda registrada com sucesso!', 'success');
      }
      this.showAddTransactionModal = false;
    } catch (error) {
      const action = this.isEditMode ? 'atualizar' : 'salvar';
      await this.showToast(`Erro ao ${action} transação`, 'danger');
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

    if (this.onlyEntries) {
      filtered = filtered.filter(t => t.type === 'entrada');
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

  goBack() {
    this.navCtrl.back();
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
