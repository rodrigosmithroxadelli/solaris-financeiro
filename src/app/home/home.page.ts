import { Component, OnInit, AfterViewInit, OnDestroy, inject, DestroyRef, ViewChild, ElementRef, HostListener, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormattingService } from '../services/formatting.service';
import { FinanceiroService, MonthlyChartData, SalesBreakdown, IndicadoresEstrategicos } from '../services/financeiro.service';

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
import { BehaviorSubject, shareReplay } from 'rxjs';
import { switchMap } from 'rxjs/operators';

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomePage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('salesChart') private salesChartRef?: ElementRef<HTMLCanvasElement>;
  formattingService = inject(FormattingService);
  private financeiroService = inject(FinanceiroService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private companyProfileService = inject(CompanyProfileService);
  private clientService = inject(ClientService);
  private storageService = inject(StorageService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  private hasLoadedClients = false;
  private salesChart?: Chart<'bar'>;
  private isMobileView = false;
  private readonly monthlyTarget = 10000;
  
  balance = { entradas: 0, saidas: 0, total: 0 };
  todaySummary = { entradas: 0, saidas: 0, saldo: 0 };
  monthSummary = { entradas: 0, saidas: 0, saldo: 0 };

  currentUserName = 'Cliente';
  greetingLabel = 'bom dia';
  todayLabel = '';
  calendarLabel = '';
  selectedMonthDate = new Date();
  private selectedMonth$ = new BehaviorSubject<Date>(this.selectedMonthDate);
  selectedMonthLabel = '';
  isCurrentMonthSelected = true;
  viewMode: 'MENSAL' | 'DIARIA' = 'MENSAL';
  selectedDayDate = new Date();
  selectedDayLabel = '';
  calendarDate = new Date().toISOString();
  todayDate = new Date().getDate();

  salesBreakdown: SalesBreakdown = {
    debito: 0,
    credito: 0,
    pix: 0,
    dinheiro: 0,
    boleto: 0,
    transferencias: 0
  };
  creditCardTotal = 0;
  showCreditCardCard = false;

  entradasPeriodo = 0;
  saidasPeriodo = 0;
  pendingPaymentsTotal = 0;
  monthlyExpensesTotal = 0;
  totalCashBalance = 0;

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
  indicadoresEstrategicos: IndicadoresEstrategicos | null = null;

  constructor() {
    addIcons({
      searchOutline, notificationsOutline, menuOutline, homeOutline, constructOutline,
      walletOutline, peopleOutline, cubeOutline, barChartOutline, personCircleOutline,
      eyeOutline, cashOutline, calendarOutline, documentTextOutline, checkboxOutline,
      cardOutline, arrowUpCircleOutline, arrowDownCircleOutline, gridOutline,
      chatbubbleEllipsesOutline, briefcaseOutline, businessOutline, ribbonOutline,
      helpCircleOutline, chevronBackOutline, chevronForwardOutline, logoInstagram,
      logoFacebook, logoYoutube, logoWhatsapp
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
        this.cdr.markForCheck();
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
        this.cdr.markForCheck();
      });

    if (!this.hasLoadedClients) {
      this.hasLoadedClients = true;
      this.clientService.getClients()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(clients => {
          this.clientsCount = clients.length;
          this.topClients = clients.slice(0, 5);
          this.cdr.markForCheck();
        });
    }

    this.financeiroService.caixaAtual$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(total => {
        this.totalCashBalance = total;
        this.balance.total = total;
        this.cdr.markForCheck();
      });

    this.financeiroService.resumoDia$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(resumo => {
        this.todaySummary = resumo;
        this.balance.entradas = resumo.entradas;
        this.balance.saidas = resumo.saidas;
        this.cdr.markForCheck();
      });

    this.financeiroService.entradasMes$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(entradas => {
        this.entradasPeriodo = entradas;
        this.cdr.markForCheck();
      });

    this.financeiroService.saidasMes$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(saidas => {
        this.saidasPeriodo = saidas;
        this.monthlyExpensesTotal = saidas;
        this.cdr.markForCheck();
      });

    this.financeiroService.pendentesEntrada$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(valor => {
        this.pendingPaymentsTotal = valor;
        this.cdr.markForCheck();
      });

    this.selectedMonth$
      .pipe(
        switchMap(date => this.financeiroService.getMonthlyChartData(date.getFullYear(), this.monthlyTarget)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(chartData => {
        this.updateSalesChart(chartData);
        this.cdr.markForCheck();
      });

    this.selectedMonth$
      .pipe(
        switchMap(date => {
          const { start, end } = this.getMonthRangeFor(date);
          return this.financeiroService.getSalesBreakdown(start, end);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(breakdown => {
        this.salesBreakdown = breakdown;
        this.creditCardTotal = breakdown.credito;
        this.showCreditCardCard = this.creditCardTotal > 0;
        this.cdr.markForCheck();
      });

    this.selectedMonth$
      .pipe(
        switchMap(date => {
          const { start, end } = this.getMonthRangeFor(date);
          return this.financeiroService.getResumoPagamento(start, end);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(resumo => {
        this.monthSummary = resumo;
        this.cdr.markForCheck();
      });

    this.refreshFinanceiroResumo();

    this.financeiroService.getLancamentos$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.updatePeriodoResumo();
        this.cdr.markForCheck();
      });

    this.financeiroService.indicadoresEstrategicos$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(indicadores => {
        this.indicadoresEstrategicos = indicadores;
        this.cdr.markForCheck();
      });
  }

  ngAfterViewInit() {
    this.updateResponsiveFlag();
  }

  ngOnDestroy() {
    this.salesChart?.destroy();
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
    if (!text) { return text; }
    return text.charAt(0).toUpperCase() + text.slice(1);
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
    this.refreshFinanceiroResumo();
    this.updatePeriodoResumo();
  }

  goToPreviousMonth() {
    this.selectedMonthDate = new Date(this.selectedMonthDate.getFullYear(), this.selectedMonthDate.getMonth() - 1, 1);
    this.updateSelectedMonthLabel();
    this.refreshFinanceiroResumo();
    this.updatePeriodoResumo();
  }

  goToNextMonth() {
    this.selectedMonthDate = new Date(this.selectedMonthDate.getFullYear(), this.selectedMonthDate.getMonth() + 1, 1);
    this.updateSelectedMonthLabel();
    this.refreshFinanceiroResumo();
    this.updatePeriodoResumo();
  }

  private refreshFinanceiroResumo() {
    this.selectedMonth$.next(new Date(this.selectedMonthDate));
  }

  private updatePeriodoResumo() {
    const { start, end } = this.getPeriodoRange();
    this.financeiroService.getPeriodoResumo(start, end)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(resumo => {
        this.entradasPeriodo = resumo.entradas;
        this.saidasPeriodo = resumo.saidas;
      });
  }

  private getPeriodoRange(): { start: Date; end: Date } {
    if (this.viewMode === 'DIARIA') {
      const start = new Date(this.selectedDayDate.getFullYear(), this.selectedDayDate.getMonth(), this.selectedDayDate.getDate(), 0, 0, 0, 0);
      const end = new Date(this.selectedDayDate.getFullYear(), this.selectedDayDate.getMonth(), this.selectedDayDate.getDate(), 23, 59, 59, 999);
      return { start, end };
    }
    return this.getMonthRangeFor(this.selectedMonthDate);
  }

  private getMonthRangeFor(date: Date): { start: Date; end: Date } {
    const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  goToNovaVenda() {
    this.router.navigate(['/sale-editor']);
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

  private initSalesChart(chartData: MonthlyChartData) {
    const context = this.salesChartRef?.nativeElement.getContext('2d');
    if (!context) {
      return;
    }
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

  private updateSalesChart(chartData: MonthlyChartData) {
    if (!this.salesChart) {
      this.initSalesChart(chartData);
      return;
    }
    this.salesChart.data.labels = chartData.labels;
    this.salesChart.data.datasets = this.buildChartDatasets(chartData);
    this.salesChart.update();
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
        datalabels: { display: false }
      },
      {
        label: 'Meta restante',
        data: data.remaining,
        backgroundColor: '#ffb44d',
        stack: 'goal',
        borderRadius: 6,
        datalabels: { display: false }
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
          font: { size: isMobile ? 10 : 12, weight: 600 },
          formatter: (_value, context) => {
            const amount = data.realized[context.dataIndex] ?? 0;
            if (amount <= 0) { return ''; }
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
          ticks: { autoSkip: false, maxRotation: isMobile ? 45 : 0, minRotation: isMobile ? 45 : 0, font: { size: isMobile ? 10 : 12 } }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { font: { size: isMobile ? 10 : 12 } }
        }
      },
      plugins: {
        legend: { display: false },
        datalabels: { clamp: true }
      }
    };
  }

  private updateResponsiveFlag() {
    this.isMobileView = typeof window !== 'undefined' && window.innerWidth <= 768;
  }

  private formatChartValue(value: number): string {
    if (!this.isMobileView) {
      return this.formattingService.formatCurrency(value);
    }
    if (value >= 1000) {
      const compact = Number((value / 1000).toFixed(1));
      const formatted = compact % 1 === 0 ? compact.toFixed(0) : compact.toFixed(1).replace('.', ',');
      return `R$ ${formatted}k`;
    }
    return `R$ ${Math.round(value)}`;
  }
}

