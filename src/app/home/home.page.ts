import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonGrid, IonRow, IonCol, IonLabel, IonItem } from '@ionic/angular/standalone';
import { FinanceService, PeriodSummary } from '../services/finance.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonGrid, IonRow, IonCol, IonLabel, IonItem]
})
export class HomePage implements OnInit {

  todaySummary: PeriodSummary | undefined;
  weekSummary: PeriodSummary | undefined;
  monthSummary: PeriodSummary | undefined;

  constructor(private financeService: FinanceService) { }

  ngOnInit() {
    const today = new Date().toISOString().split('T')[0];
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;

    this.todaySummary = this.financeService.getDailySummary(today);
    this.weekSummary = this.financeService.getWeeklySummary(today);
    this.monthSummary = this.financeService.getMonthlySummary(year, month);
  }

  formatCurrency(value: number): string {
    return this.financeService.formatCurrency(value);
  }
}
