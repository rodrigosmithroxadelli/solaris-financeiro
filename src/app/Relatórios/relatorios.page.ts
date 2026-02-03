import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject, DestroyRef } from '@angular/core';
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
import { FinancialService } from '../services/financial.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RelatoriosPage implements OnInit {
  financeService = inject(FinanceService);
  private financialService = inject(FinancialService);
  private exportService = inject(ExportService);
  private toastController = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  periodType: 'dia' | 'semana' | 'mes' = 'mes';
  selectedDate: string = new Date().toISOString();
  summary: PeriodSummary | null = null;
  
  allTransactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];

  categoryData: { [key: string]: number } = {};
  paymentMethodData: { [key: string]: number } = {};

  // New properties for memoized getters
  categoryEntries: Array<{ category: string; amount: number }> = [];
  paymentMethodEntries: Array<{ method: string; amount: number }> = [];
  averageEntradas: number = 0;
  averageSaidas: number = 0;
  maxAmountForPercentage: number = 0;
  totalCashBalance = 0;

  constructor() {
    addIcons({ download, calendar, barChart, pieChart });
  }

  ngOnInit() {
    this.financeService.transactions$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => {
        this.allTransactions = data;
        this.processData();
        this.cdr.detectChanges(); // Manually trigger change detection
      });

    this.financialService.getRegistros()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(records => {
        const paidRecords = records.filter(record => record.statusPagamento !== 'PENDENTE');
        const entradas = paidRecords
          .filter(record => record.tipo === 'entrada')
          .reduce((acc, curr) => acc + curr.valor, 0);
        const saidas = paidRecords
          .filter(record => record.tipo === 'saida')
          .reduce((acc, curr) => acc + curr.valor, 0);
        this.totalCashBalance = entradas - saidas;
        this.cdr.detectChanges();
      });
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

    this.filteredTransactions = this.allTransactions.filter(transaction => {
      if (this.financeService.normalizePaymentStatus(transaction.paymentStatus) !== 'PAGO') {
        return false;
      }
      const transactionDate = new Date(transaction.date);
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

    // Memoized computations
    this.categoryEntries = Object.entries(this.categoryData)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    const methodLabels: { [key: string]: string } = {
      pix: 'PIX',
      dinheiro: 'Dinheiro',
      cartao_credito: 'Cartão de Crédito',
      cartao_debito: 'Cartão de Débito'
    };
    this.paymentMethodEntries = Object.entries(this.paymentMethodData)
      .map(([method, amount]) => ({
        method: methodLabels[method] || method,
        amount
      }))
      .sort((a, b) => b.amount - a.amount);
    
    this.averageEntradas = this.getAverage(totalEntradas, 'entrada');
    this.averageSaidas = this.getAverage(totalSaidas, 'saida');

    this.maxAmountForPercentage = Math.max(
      this.summary.totalEntradas,
      this.summary.totalSaidas,
      ...Object.values(this.categoryData),
      ...Object.values(this.paymentMethodData)
    );
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
    this.cdr.detectChanges(); // Manually trigger change detection
  }

  onDateChange(event: any) {
    this.selectedDate = event.detail.value;
    this.processData();
    this.cdr.detectChanges(); // Manually trigger change detection
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
  
  getAverage(total: number, type: 'entrada' | 'saida'): number {
    const count = this.filteredTransactions.filter(t => t.type === type).length;
    return count > 0 ? total / count : 0;
  }
  
  getPercentage(amount: number): number {
    if (!this.summary || this.maxAmountForPercentage === 0) return 0;
    return (amount / this.maxAmountForPercentage) * 100;
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
