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
    CommonModule,
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
  
  allTransactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];

  categoryData: { [key: string]: number } = {};
  paymentMethodData: { [key: string]: number } = {};
  private transactionsSubscription?: Subscription;

  constructor(
    public financeService: FinanceService,
    private exportService: ExportService,
    private toastController: ToastController
  ) {
    addIcons({ download, calendar, barChart, pieChart });
  }

  ngOnInit() {
    this.transactionsSubscription = this.financeService.transactions$.subscribe(data => {
      this.allTransactions = data;
      this.processData();
    });
  }

  ngOnDestroy() {
    this.transactionsSubscription?.unsubscribe();
  }

  processData() {
    const date = new Date(this.selectedDate);
    let startDate: Date;
    let endDate: Date;

    switch (this.periodType) {
      case 'dia':
        startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
        endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
        break;
      case 'semana':
        const firstDayOfWeek = date.getDate() - date.getDay();
        startDate = new Date(date.setDate(firstDayOfWeek));
        startDate.setHours(0,0,0,0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'mes':
        startDate = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0);
        endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
    }

    this.filteredTransactions = this.allTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });

    const totalEntradas = this.filteredTransactions
      .filter(t => t.type === 'entrada')
      .reduce((acc, t) => acc + t.amount, 0);
    
    const totalSaidas = this.filteredTransactions
      .filter(t => t.type === 'saida')
      .reduce((acc, t) => acc + t.amount, 0);

    this.summary = {
      totalEntradas,
      totalSaidas,
      saldo: totalEntradas - totalSaidas,
      date: this.selectedDate
    };

    this.categoryData = this.aggregateBy(this.filteredTransactions, 'category');
    this.paymentMethodData = this.aggregateBy(this.filteredTransactions, 'paymentMethod');
  }

  private aggregateBy(transactions: Transaction[], key: keyof Transaction): { [key: string]: number } {
    return transactions.reduce((acc, t) => {
      const group = t[key] as string;
      if (group) {
        acc[group] = (acc[group] || 0) + t.amount;
      }
      return acc;
    }, {} as { [key: string]: number });
  }

  onPeriodChange() {
    this.processData();
  }

  onDateChange(event: any) {
    this.selectedDate = event.detail.value;
    this.processData();
  }

  async exportPDF() {
    if (!this.summary || this.filteredTransactions.length === 0) {
      await this.showToast('Nenhum dado para exportar', 'warning');
      return;
    }
    try {
      await this.exportService.exportToPDF(this.summary, this.filteredTransactions, this.periodType);
      await this.showToast('PDF exportado com sucesso!', 'success');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      await this.showToast('Erro ao exportar PDF', 'danger');
    }
  }

  async exportExcel() {
    if (!this.summary || this.filteredTransactions.length === 0) {
      await this.showToast('Nenhum dado para exportar', 'warning');
      return;
    }
    try {
      await this.exportService.exportToExcel(this.summary, this.filteredTransactions, this.periodType);
      await this.showToast('Excel exportado com sucesso!', 'success');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      await this.showToast('Erro ao exportar Excel', 'danger');
    }
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
    const count = this.filteredTransactions.filter(t => t.type === type).length;
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
