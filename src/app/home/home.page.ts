
import { Component, OnInit, AfterViewInit, OnDestroy, inject, DestroyRef, ViewChild, ElementRef, HostListener } from '@angular/core';

import { FinanceService, CashFlowSummary } from '../services/finance.service';
import { FinancialService, FinancialRecord } from '../services/financial.service';

import { Transaction } from '../models/transaction.model';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { RouterModule, Router } from '@angular/router';
import { Chart, ChartDataset, ChartOptions, registerables, Plugin } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

import { addIcons } from 'ionicons';

import {

  searchOutline,

  notificationsOutline,

  menuOutline,

  homeOutline,

  constructOutline,

  walletOutline,

  peopleOutline,

  cubeOutline,

  barChartOutline,

  personCircleOutline,

  eyeOutline,

  cashOutline,

  calendarOutline,

  documentTextOutline,

  checkboxOutline,

  cardOutline,

  arrowUpCircleOutline,

  arrowDownCircleOutline,

  gridOutline,

  chatbubbleEllipsesOutline,

  briefcaseOutline,

  businessOutline,

  ribbonOutline,

  helpCircleOutline,

  chevronBackOutline,

  chevronForwardOutline,

  logoInstagram,

  logoFacebook,

  logoYoutube,

  logoWhatsapp

} from 'ionicons/icons';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { shareReplay } from 'rxjs';

import { AuthService } from '../services/auth.service';

import { CompanyProfileService } from '../services/company-profile.service';
import { CompanyProfile } from '../models/company-profile.model';

import { ClientService } from '../services/client.service';

import { StorageService } from '../services/storage.service';

import { Client } from '../models/client.model';

Chart.register(...registerables, ChartDataLabels);

const realizedOverlayLinePlugin: Plugin<'bar'> = {
  id: 'realizedOverlayLine',
  afterDatasetsDraw(chart) {
    const datasetIndex = chart.data.datasets.findIndex(dataset => dataset.label === 'Realizado');
    if (datasetIndex < 0) {
      return;
    }
    const meta = chart.getDatasetMeta(datasetIndex);
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = '#1f58d6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let hasStarted = false;
    meta.data.forEach((element, index) => {
      const value = chart.data.datasets[datasetIndex].data[index] as number | undefined;
      if (!value && value !== 0) {
        return;
      }
      const x = element.x;
      const y = element.y;
      if (!hasStarted) {
        ctx.moveTo(x, y);
        hasStarted = true;
      } else {
        ctx.lineTo(x, y);
      }
    });
    if (hasStarted) {
      ctx.stroke();
    }
    meta.data.forEach((element, index) => {
      const value = chart.data.datasets[datasetIndex].data[index] as number | undefined;
      if (!value && value !== 0) {
        return;
      }
      ctx.beginPath();
      ctx.fillStyle = '#1f58d6';
      ctx.arc(element.x, element.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
};

interface MonthlyChartData {
  labels: string[];
  realized: number[];
  remaining: number[];
  marker: Array<[number, number]>;
}



@Component({

  selector: 'app-home',

  templateUrl: 'home.page.html',

  styleUrls: ['home.page.scss'],

  standalone: true,

  imports: [

    CommonModule,
    FormsModule,

    IonicModule,

    RouterModule

  ]

})

export class HomePage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('salesChart') private salesChartRef?: ElementRef<HTMLCanvasElement>;
  financeService = inject(FinanceService);
  private financialService = inject(FinancialService);

  private authService = inject(AuthService);

  private companyProfileService = inject(CompanyProfileService);

  private clientService = inject(ClientService);

  private storageService = inject(StorageService);
  private router = inject(Router);

  private destroyRef = inject(DestroyRef);
  private hasLoadedClients = false;
  private salesChart?: Chart<'bar'>;
  private pendingChartData?: MonthlyChartData;
  private isMobileView = false;
  private readonly monthlyTarget = 10000;
  private readonly monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];



  transactions: Transaction[] = [];

  balance = { entradas: 0, saidas: 0, total: 0 };

  todaySummary: CashFlowSummary = { entradas: 0, saidas: 0, saldo: 0 };

  weekSummary: CashFlowSummary = { entradas: 0, saidas: 0, saldo: 0 };

  monthSummary: CashFlowSummary = { entradas: 0, saidas: 0, saldo: 0 };



  currentUserName = 'Cliente';

  greetingLabel = 'bom dia';

  todayLabel = '';

  calendarLabel = '';

  selectedMonthDate = new Date();

  selectedMonthLabel = '';

  isCurrentMonthSelected = true;

  viewMode: 'MENSAL' | 'DIARIA' = 'MENSAL';

  selectedDayDate = new Date();

  selectedDayLabel = '';

  calendarDate = new Date().toISOString();

  todayDate = new Date().getDate();



  salesBreakdown = {

    debito: 0,

    credito: 0,

    pix: 0,

    dinheiro: 0,

    boleto: 0,

    transferencias: 0

  };

  creditCardTotal = 0;

  showCreditCardCard = false;

  monthlyCreditCardTotal = 0;

  entradasPeriodo = 0;
  saidasPeriodo = 0;
  faturasCartaoPeriodo = 0;

  private financialRecords: FinancialRecord[] = [];

  entradasHoje = 0;
  saidasHoje = 0;
  faturasCartaoHoje = 0;






  budgetsPending = 0;

  budgetsApproved = 0;

  occupiedSlots = 0;

  totalSlots = 10;

  completedSlots = 0;

  postSalesPending = 0;

  postSalesCompleted = 0;

  employeesCount = 0;

  companyName = 'Solaris';

  companySinceLabel = '27/01/2026';

  subscriptionLabel = 'Teste grátis';

  clientsCount = 0;

  topClients: Client[] = [];



  constructor() {

    addIcons({

      searchOutline,

      notificationsOutline,

      menuOutline,

      homeOutline,

      constructOutline,

      walletOutline,

      peopleOutline,

      cubeOutline,

      barChartOutline,

      personCircleOutline,

      eyeOutline,

      cashOutline,

      calendarOutline,

      documentTextOutline,

      checkboxOutline,

      cardOutline,

      arrowUpCircleOutline,

      arrowDownCircleOutline,

      gridOutline,

      chatbubbleEllipsesOutline,

      briefcaseOutline,

      businessOutline,

      ribbonOutline,

      helpCircleOutline,

      chevronBackOutline,

      chevronForwardOutline,

      logoInstagram,

      logoFacebook,

      logoYoutube,

      logoWhatsapp

    });

  }



  ngOnInit() {

    this.setDateLabels();

    this.updateSelectedMonthLabel();
    this.updateSelectedDayLabel();

    this.employeesCount = this.storageService.getUsers().length;



    this.authService.currentUser$

      .pipe(takeUntilDestroyed(this.destroyRef))

      .subscribe(user => {

        this.currentUserName = user?.displayName || user?.email?.split('@')[0] || 'Cliente';

      });



    const companyProfile$ = this.companyProfileService.getCompanyProfile()
      .pipe(shareReplay({ bufferSize: 1, refCount: true }));

    companyProfile$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(profile => {
        const companyProfile = profile as CompanyProfile | null;
        if (companyProfile?.name) {
          this.companyName = companyProfile.name;
        }
      });



    if (!this.hasLoadedClients) {
      this.hasLoadedClients = true;
      this.clientService.getClients()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(clients => {
          this.clientsCount = clients.length;
          this.topClients = clients.slice(0, 5);
        });
    }



    this.financeService.transactions$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => {
        this.transactions = data;
        this.calculateBalance();
        this.applyDateFilters(data);
        this.updateSalesChart();
      });



    const today = new Date();

    this.financeService.getSummaryForPeriod('day', today)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(summary => {
        this.todaySummary = summary;
        this.calculateBalance();
      });

    this.financialService.getRegistros()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(records => {
        this.financialRecords = records;
        this.updatePeriodoResumo();
      });

  }

  ngAfterViewInit() {
    this.updateResponsiveFlag();
    this.initSalesChart();
  }

  ngOnDestroy() {
    this.salesChart?.destroy();
  }



  calculateBalance() {
    const entradas = this.todaySummary.entradas;
    const saidas = this.todaySummary.saidas;



    this.balance = {

      entradas,

      saidas,

      total: entradas - saidas

    };

  }



  private setDateLabels() {

    const now = new Date();

    const hour = now.getHours();

    if (hour >= 5 && hour < 12) {

      this.greetingLabel = 'bom dia';

    } else if (hour >= 12 && hour < 18) {

      this.greetingLabel = 'boa tarde';

    } else {

      this.greetingLabel = 'boa noite';

    }



    const dayLabel = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });

    const weekdayLabel = this.capitalize(now.toLocaleDateString('pt-BR', { weekday: 'long' }));

    this.todayLabel = `${dayLabel}, ${weekdayLabel}`;



    const monthLabel = this.capitalize(now.toLocaleDateString('pt-BR', { month: 'long' }));

    this.calendarLabel = `${monthLabel} / ${now.getFullYear()}`;

    this.todayDate = now.getDate();

  }



  private capitalize(text: string): string {

    if (!text) {

      return text;

    }

    return text.charAt(0).toUpperCase() + text.slice(1);

  }



  private updateSalesBreakdown(transactions: Transaction[]) {

    const breakdown = {

      debito: 0,

      credito: 0,

      pix: 0,

      dinheiro: 0,

      boleto: 0,

      transferencias: 0

    };



    transactions
      .filter(t => t.type === 'entrada')

      .forEach(t => {

        switch (t.paymentMethod) {

          case 'cartao_debito':

            breakdown.debito += t.amount;

            break;

          case 'cartao_credito':

            breakdown.credito += t.amount;

            break;

          case 'pix':

            breakdown.pix += t.amount;

            break;

          case 'dinheiro':

            breakdown.dinheiro += t.amount;

            break;

          case 'boleto':

            breakdown.boleto += t.amount;

            break;

          case 'transferencia':

            breakdown.transferencias += t.amount;

            break;

          default:

            break;

        }

      });



    this.salesBreakdown = breakdown;

    this.creditCardTotal = breakdown.credito;

    this.showCreditCardCard = this.creditCardTotal > 0;

  }

  private applyDateFilters(transactions: Transaction[]) {
    const selectedTransactions = this.filterTransactionsByViewMode(transactions);
    this.monthSummary = this.calculateSummary(selectedTransactions);
    this.updateSalesBreakdown(selectedTransactions);

    const creditCardTotal = selectedTransactions
      .filter(t => t.type === 'entrada' && t.paymentMethod === 'cartao_credito')
      .reduce((acc, curr) => acc + curr.amount, 0);

    this.monthlyCreditCardTotal = creditCardTotal;
    this.showCreditCardCard = creditCardTotal > 0;
  }

  private calculateSummary(transactions: Transaction[]): CashFlowSummary {

    const entradas = transactions.filter(t => t.type === 'entrada').reduce((acc, curr) => acc + curr.amount, 0);

    const saidas = transactions.filter(t => t.type === 'saida').reduce((acc, curr) => acc + curr.amount, 0);

    return { entradas, saidas, saldo: entradas - saidas };

  }

  private filterTransactionsByMonth(transactions: Transaction[], monthDate: Date): Transaction[] {

    const startMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 0, 0, 0);

    const endMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);

    return transactions.filter(t => {

      const txDate = new Date(t.date);

      return txDate >= startMonth && txDate <= endMonth;

    });

  }

  private filterTransactionsByViewMode(transactions: Transaction[]): Transaction[] {
    if (this.viewMode === 'DIARIA') {
      return this.filterTransactionsByDay(transactions, this.selectedDayDate);
    }
    return this.filterTransactionsByMonth(transactions, this.selectedMonthDate);
  }

  private filterTransactionsByDay(transactions: Transaction[], dayDate: Date): Transaction[] {
    const startDay = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 0, 0, 0, 0);
    const endDay = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 23, 59, 59, 999);
    return transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= startDay && txDate <= endDay;
    });
  }

  private updateSelectedMonthLabel() {

    const monthLabel = this.capitalize(this.selectedMonthDate.toLocaleDateString('pt-BR', { month: 'long' }));

    this.selectedMonthLabel = `${monthLabel} / ${this.selectedMonthDate.getFullYear()}`;

    const today = new Date();

    this.isCurrentMonthSelected = today.getFullYear() === this.selectedMonthDate.getFullYear()
      && today.getMonth() === this.selectedMonthDate.getMonth();

  }

  private updateSelectedDayLabel() {
    const dayLabel = this.selectedDayDate.toLocaleDateString('pt-BR');
    this.selectedDayLabel = dayLabel;
  }

  onViewModeChange(mode: 'MENSAL' | 'DIARIA') {
    this.viewMode = mode;
    this.applyDateFilters(this.transactions);
    this.updatePeriodoResumo();
  }

  goToPreviousMonth() {

    this.selectedMonthDate = new Date(this.selectedMonthDate.getFullYear(), this.selectedMonthDate.getMonth() - 1, 1);

    this.updateSelectedMonthLabel();

    this.applyDateFilters(this.transactions);
    this.updatePeriodoResumo();
    this.updateSalesChart();

  }

  goToNextMonth() {

    this.selectedMonthDate = new Date(this.selectedMonthDate.getFullYear(), this.selectedMonthDate.getMonth() + 1, 1);

    this.updateSelectedMonthLabel();

    this.applyDateFilters(this.transactions);
    this.updatePeriodoResumo();
    this.updateSalesChart();

  }

  private updatePeriodoResumo() {
    const { start, end } = this.getPeriodoRange();
    const recordsInRange = this.financialRecords.filter(record => {
      const recordDate = record.data.toDate();
      return recordDate >= start && recordDate <= end;
    });

    this.entradasPeriodo = this.sumByTipo(recordsInRange, 'entrada');
    this.saidasPeriodo = this.sumByTipo(recordsInRange, 'saida');
    this.faturasCartaoPeriodo = recordsInRange
      .filter(record => record.tipo === 'entrada' && record.metodoPagamento === 'credito')
      .reduce((acc, curr) => acc + curr.valor, 0);

    this.balance = {
      entradas: this.entradasPeriodo,
      saidas: this.saidasPeriodo,
      total: this.entradasPeriodo - this.saidasPeriodo
    };
  }

  private getPeriodoRange(): { start: Date; end: Date } {
    if (this.viewMode === 'DIARIA') {
      const start = new Date(this.selectedDayDate.getFullYear(), this.selectedDayDate.getMonth(), this.selectedDayDate.getDate(), 0, 0, 0, 0);
      const end = new Date(this.selectedDayDate.getFullYear(), this.selectedDayDate.getMonth(), this.selectedDayDate.getDate(), 23, 59, 59, 999);
      return { start, end };
    }
    const start = new Date(this.selectedMonthDate.getFullYear(), this.selectedMonthDate.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(this.selectedMonthDate.getFullYear(), this.selectedMonthDate.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  private sumByTipo(records: FinancialRecord[], tipo: FinancialRecord['tipo']): number {
    return records
      .filter(record => record.tipo === tipo)
      .reduce((acc, curr) => acc + curr.valor, 0);
  }

  goToNovaVenda() {
    this.router.navigate(['/tabs/caixa']);
  }

  @HostListener('window:resize')
  onResize() {
    const wasMobile = this.isMobileView;
    this.updateResponsiveFlag();
    if (this.salesChart && wasMobile !== this.isMobileView) {
      this.salesChart.options = this.buildChartOptions();
      this.salesChart.update();
    }
  }

  private initSalesChart() {
    const context = this.salesChartRef?.nativeElement.getContext('2d');
    if (!context) {
      return;
    }
    const chartData = this.pendingChartData ?? this.buildMonthlyChartData(this.transactions);
    this.pendingChartData = undefined;
    this.salesChart = new Chart(context, {
      type: 'bar',
      data: {
        labels: chartData.labels,
        datasets: this.buildChartDatasets(chartData)
      },
      options: this.buildChartOptions(),
      plugins: [realizedOverlayLinePlugin]
    });
  }

  private updateSalesChart() {
    const chartData = this.buildMonthlyChartData(this.transactions);
    if (!this.salesChart) {
      this.pendingChartData = chartData;
      return;
    }
    this.salesChart.data.labels = chartData.labels;
    this.salesChart.data.datasets = this.buildChartDatasets(chartData);
    this.salesChart.update();
  }

  private buildMonthlyChartData(transactions: Transaction[]): MonthlyChartData {
    const year = this.selectedMonthDate.getFullYear();
    const realized = Array.from({ length: 12 }, () => 0);
    transactions
      .filter(transaction => transaction.type === 'entrada')
      .forEach(transaction => {
        const date = new Date(transaction.date);
        if (date.getFullYear() !== year) {
          return;
        }
        realized[date.getMonth()] += transaction.amount;
      });

    const remaining = realized.map(value => Math.max(this.monthlyTarget - value, 0));
    const maxRealized = Math.max(...realized, this.monthlyTarget, 1);
    const markerHeight = Math.max(maxRealized * 0.02, 1);
    const marker = realized.map(value => (
      value > 0 ? [Math.max(value - markerHeight, 0), value] as [number, number] : [0, 0] as [number, number]
    ));

    return {
      labels: [...this.monthLabels],
      realized,
      remaining,
      marker
    };
  }

  private buildChartDatasets(data: MonthlyChartData): ChartDataset<'bar'>[] {
    const isMobile = this.isMobileView;
    return [
      {
        label: 'Realizado',
        data: data.realized,
        backgroundColor: '#49c97d',
        stack: 'goal',
        borderRadius: 6,
        datalabels: {
          display: false
        }
      },
      {
        label: 'Meta restante',
        data: data.remaining,
        backgroundColor: '#ffb44d',
        stack: 'goal',
        borderRadius: 6,
        datalabels: {
          display: false
        }
      },
      {
        label: 'Indicador',
        data: data.marker,
        backgroundColor: '#4fa3ff',
        stack: 'marker',
        grouped: false,
        barThickness: isMobile ? 4 : 6,
        borderRadius: 4,
        order: 3,
        datalabels: {
          display: true,
          anchor: 'end',
          align: 'end',
          offset: 2,
          font: {
            size: isMobile ? 10 : 12,
            weight: 600
          },
          formatter: (_value, context) => {
            const amount = data.realized[context.dataIndex] ?? 0;
            if (amount <= 0) {
              return '';
            }
            return this.formatChartValue(amount);
          }
        }
      }
    ];
  }

  private buildChartOptions(): ChartOptions<'bar'> {
    const isMobile = this.isMobileView;
    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          ticks: {
            autoSkip: false,
            maxRotation: isMobile ? 45 : 0,
            minRotation: isMobile ? 45 : 0,
            font: {
              size: isMobile ? 10 : 12
            }
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            font: {
              size: isMobile ? 10 : 12
            }
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        datalabels: {
          clamp: true
        }
      }
    };
  }

  private updateResponsiveFlag() {
    this.isMobileView = typeof window !== 'undefined' && window.innerWidth <= 768;
  }

  private formatChartValue(value: number): string {
    if (!this.isMobileView) {
      return this.financeService.formatCurrency(value);
    }
    if (value >= 1000) {
      const compact = Number((value / 1000).toFixed(1));
      const formatted = compact % 1 === 0 ? compact.toFixed(0) : compact.toFixed(1).replace('.', ',');
      return `R$ ${formatted}k`;
    }
    return `R$ ${Math.round(value)}`;
  }

}

