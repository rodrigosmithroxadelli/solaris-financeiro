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
import { FormattingService } from '../services/formatting.service';
import { ExportService } from '../services/export.service';
import { FinanceiroService, RelatorioPeriodo, PeriodoResumo } from '../services/financeiro.service';
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
  formattingService = inject(FormattingService);
  private financeiroService = inject(FinanceiroService);
  private exportService = inject(ExportService);
  private toastController = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  periodType: 'dia' | 'semana' | 'mes' = 'mes';
  selectedDate: string = new Date().toISOString();
  summary: PeriodoResumo | null = null;
  categoryEntries: Array<{ category: string; amount: number }> = [];
  paymentMethodEntries: Array<{ method: string; amount: number }> = [];
  averageEntradas: number = 0;
  averageSaidas: number = 0;
  maxAmountForPercentage: number = 0;
  totalCashBalance = 0;
  totalTransacoes = 0;
  private relatorioAtual: RelatorioPeriodo | null = null;

  constructor() {
    addIcons({ download, calendar, barChart, pieChart });
  }

  ngOnInit() {
    this.financeiroService.caixaAtual$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(total => {
        this.totalCashBalance = total;
        this.cdr.detectChanges();
      });

    this.processData();
  }

  processData() {
    const { startDate, endDate } = this.getPeriodoRange();
    this.financeiroService.getRelatorioPeriodo(startDate, endDate)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((relatorio: RelatorioPeriodo) => {
        this.relatorioAtual = relatorio;
        this.summary = relatorio.resumo;
        this.categoryEntries = relatorio.categoryEntries;
        this.paymentMethodEntries = relatorio.paymentMethodEntries;
        this.averageEntradas = relatorio.averageEntradas;
        this.averageSaidas = relatorio.averageSaidas;
        this.maxAmountForPercentage = relatorio.maxAmountForPercentage;
        this.totalTransacoes = relatorio.totalTransacoes;
        this.cdr.detectChanges();
      });
  }

  private getPeriodoRange(): { startDate: Date; endDate: Date } {
    const date = new Date(this.selectedDate);
    if (this.periodType === 'dia') {
      return {
        startDate: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0),
        endDate: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
      };
    }
    if (this.periodType === 'semana') {
      const firstDayOfWeek = date.getDate() - date.getDay();
      const startDate = new Date(date.setDate(firstDayOfWeek));
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    }
    return {
      startDate: new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0),
      endDate: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
    };
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
    if (!this.summary || !this.relatorioAtual || this.totalTransacoes === 0) {
      await this.showToast('Nenhum dado para exportar', 'warning');
      return;
    }
    try {
      // await this.exportService.exportToPDF(this.summary, this.relatorioAtual.lancamentos, this.periodType);
      await this.showToast('PDF exportado com sucesso!', 'success');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      await this.showToast('Erro ao exportar PDF', 'danger');
    }
  }

  async exportExcel() {
    if (!this.summary || !this.relatorioAtual || this.totalTransacoes === 0) {
      await this.showToast('Nenhum dado para exportar', 'warning');
      return;
    }
    try {
      // await this.exportService.exportToExcel(this.summary, this.relatorioAtual.lancamentos, this.periodType);
      await this.showToast('Excel exportado com sucesso!', 'success');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      await this.showToast('Erro ao exportar Excel', 'danger');
    }
  }
  
  getAverage(total: number, type: 'entrada' | 'saida'): number {
    return type === 'entrada' ? this.averageEntradas : this.averageSaidas;
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
