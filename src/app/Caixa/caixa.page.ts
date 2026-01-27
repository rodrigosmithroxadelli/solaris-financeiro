import { Component, OnInit, OnDestroy } from '@angular/core';
import { ModalController, ToastController, AlertController } from '@ionic/angular';
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
  IonDatetime
} from '@ionic/angular/standalone';
import { FinanceService, CashFlowSummary } from '../services/finance.service';
import { Transaction } from '../models/transaction.model';
import { AddTransactionModalComponent } from '../components/add-transaction-modal/add-transaction-modal.component';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { add, create, trash, arrowUp, arrowDown, calendar, personCircleOutline } from 'ionicons/icons';

@Component({
  selector: 'app-caixa',
  templateUrl: 'caixa.page.html',
  styleUrls: ['caixa.page.scss'],
  standalone: true,
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
    IonDatetime
  ],
  providers: [ModalController, ToastController, AlertController]
})
export class CaixaPage implements OnInit, OnDestroy {
  transactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  summary: CashFlowSummary = { totalEntradas: 0, totalSaidas: 0, saldo: 0 };
  searchTerm: string = '';
  selectedDate: string = '';
  private subscription?: Subscription;

  constructor(
    private financeService: FinanceService,
    private modalController: ModalController,
    private toastController: ToastController,
    private alertController: AlertController
  ) {
    addIcons({ add, create, trash, arrowUp, arrowDown, calendar, personCircleOutline });
  }

  ngOnInit() {
    this.loadData();
    this.subscription = this.financeService.transactions$.subscribe(() => {
      this.loadData();
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  loadData() {
    this.transactions = this.financeService.getAllTransactions();
    this.filteredTransactions = [...this.transactions];
    this.summary = this.financeService.getCashFlowSummary();
    this.applyFilters();
  }

  async openAddModal(transaction?: Transaction) {
    const modal = await this.modalController.create({
      component: AddTransactionModalComponent,
      componentProps: { transaction }
    });
    
    await modal.present();
    
    // Recarrega dados após fechar o modal
    const { data } = await modal.onDidDismiss();
    if (data?.saved) {
      this.loadData();
    }
  }

  async editTransaction(transaction: Transaction) {
    await this.openAddModal(transaction);
  }

  async deleteTransaction(transaction: Transaction) {
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
            this.financeService.deleteTransaction(transaction.id);
            this.showToast('Transação excluída com sucesso', 'success');
          }
        }
      ]
    });
    await alert.present();
  }

  async refresh(event: any) {
    this.loadData();
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
        t.category.toLowerCase().includes(term) ||
        (t.description && t.description.toLowerCase().includes(term)) ||
        (t.clientName && t.clientName.toLowerCase().includes(term))
      );
    }

    // Filtro por data
    if (this.selectedDate) {
      const selected = new Date(this.selectedDate);
      selected.setHours(0, 0, 0, 0);
      const endDate = new Date(selected);
      endDate.setHours(23, 59, 59, 999);

      filtered = filtered.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= selected && transactionDate <= endDate;
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

  private async showToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'top'
    });
    await toast.present();
  }
}