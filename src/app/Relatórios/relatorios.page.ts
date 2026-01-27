import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonIcon,
  IonDatetimeButton,
  IonModal,
  IonDatetime,
  ToastController
} from '@ionic/angular/standalone';
import { FinanceService, PeriodSummary } from '../services/finance.service';
import { ExportService } from '../services/export.service';
import { Transaction } from '../models/transaction.model';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import { download, calendar, barChart, pieChart } from 'ionicons/icons';

@Component({
  selector: 'app-relatorios',
  templateUrl: 'relatorios.page.html',
  styleUrls: ['relatorios.page.scss'],
  standalone: true,
  imports: [
    CommonModule, // Necessário para *ngIf e *ngFor
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonIcon,
    IonDatetimeButton,
    IonModal,
    IonDatetime
  ]
})
export class RelatoriosPage implements OnInit, OnDestroy {
  periodType: 'dia' | 'semana' | 'mes' = 'mes';
  selectedDate: string = new Date().toISOString();
  summary: PeriodSummary | null = null;
  transactions: Transaction[] = [];
  categoryData: { [key: string]: number } = {};
  paymentMethodData: { [key: string]: number } = {};
  private subscription?: Subscription;

  constructor(
    private financeService: FinanceService,
    private exportService: ExportService,
    private toastController: ToastController
  ) {
    addIcons({ download, calendar, barChart, pieChart });
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
    const date = new Date(this.selectedDate);
    
    switch (this.periodType) {
      case 'dia':
        this.summary = this.financeService.getDailySummary(this.selectedDate);
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        this.transactions = this.financeService.getTransactionsByDateRange(
          dayStart.toISOString(),
          dayEnd.toISOString()
        );
        break;
      case 'semana':
        this.summary = this.financeService.getWeeklySummary(this.selectedDate);
        const weekStart = new Date(date);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        this.transactions = this.financeService.getTransactionsByDateRange(
          weekStart.toISOString(),
          weekEnd.toISOString()
        );
        break;
      case 'mes':
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        this.summary = this.financeService.getMonthlySummary(year, month);
        const monthStart = new Date(year, month - 1, 1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(year, month, 0);
        monthEnd.setHours(23, 59, 59, 999);
        this.transactions = this.financeService.getTransactionsByDateRange(
          monthStart.toISOString(),
          monthEnd.toISOString()
        );
        break;
    }

    this.loadCategoryData();
    this.loadPaymentMethodData();
  }

  loadCategoryData() {
    const entradas = this.financeService.getTransactionsByCategory('entrada');
    const saidas = this.financeService.getTransactionsByCategory('saida');
    this.categoryData = { ...entradas, ...saidas };
  }

  loadPaymentMethodData() {
    this.paymentMethodData = this.financeService.getTransactionsByPaymentMethod();
  }

  onPeriodChange() {
    this.loadData();
  }

  onDateChange(event: any) {
    this.selectedDate = event.detail.value;
    this.loadData();
  }

  async exportPDF() {
    if (!this.summary) {
      await this.showToast('Nenhum dado para exportar', 'warning');
      return;
    }
    try {
      await this.exportService.exportToPDF(this.summary, this.transactions);
      await this.showToast('PDF exportado com sucesso!', 'success');
    } catch (error) {
      await this.showToast('Erro ao exportar PDF', 'danger');
    }
  }

  async exportExcel() {
    if (!this.summary) {
      await this.showToast('Nenhum dado para exportar', 'warning');
      return;
    }
    try {
      await this.exportService.exportToExcel(this.summary, this.transactions);
      await this.showToast('Excel exportado com sucesso!', 'success');
    } catch (error) {
      await this.showToast('Erro ao exportar Excel', 'danger');
    }
  }

  formatCurrency(value: number): string {
    return this.financeService.formatCurrency(value);
  }

  formatDate(date: string): string {
    return this.financeService.formatDate(date);
  }

  getCategoryEntries(): Array<{ category: string; amount: number }> {
    return Object.entries(this.categoryData)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }

  getPaymentMethodEntries(): Array<{ method: string; amount: number }> {
    const methodLabels: { [key: string]: string } = {
      pix: 'PIX',
      dinheiro: 'Dinheiro',
      cartao_credito: 'Cartão de Crédito',
      cartao_debito: 'Cartão de Débito'
    };

    return Object.entries(this.paymentMethodData)
      .map(([method, amount]) => ({
        method: methodLabels[method] || method,
        amount
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  getAverage(total: number, type: 'entrada' | 'saida'): number {
    const count = this.transactions.filter(t => t.type === type).length;
    return count > 0 ? total / count : 0;
  }

  getPercentage(amount: number): number {
    if (!this.summary) return 0;
    const maxAmount = Math.max(
      this.summary.totalEntradas,
      this.summary.totalSaidas,
      ...Object.values(this.categoryData),
      ...Object.values(this.paymentMethodData)
    );
    return maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
  }

  getComparisonPercentage(value: number): number {
    if (!this.summary) return 0;
    const maxValue = Math.max(this.summary.totalEntradas, this.summary.totalSaidas);
    return maxValue > 0 ? (value / maxValue) * 100 : 0;
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
