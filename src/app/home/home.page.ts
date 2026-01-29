import { Component, OnInit, inject } from '@angular/core';
import { FinanceService, CashFlowSummary } from '../services/finance.service';
import { Transaction } from '../models/transaction.model';

// Import necessary modules for standalone component and its template
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular'; // Provides Ion components and ModalController

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true, // Mark as standalone
  imports: [
    CommonModule,
    IonicModule // Import IonicModule
  ]
})
export class HomePage implements OnInit {
  financeService = inject(FinanceService);

  transactions: Transaction[] = [];
  balance = { entradas: 0, saidas: 0, total: 0 };

  todaySummary: CashFlowSummary = { entradas: 0, saidas: 0, saldo: 0 };
  weekSummary: CashFlowSummary = { entradas: 0, saidas: 0, saldo: 0 };
  monthSummary: CashFlowSummary = { entradas: 0, saidas: 0, saldo: 0 };

  ngOnInit() {
    // Aqui o app se conecta ao fluxo de dados do Google
    this.financeService.transactions$.subscribe(data => {
      this.transactions = data;
      this.calculateBalance();
    });

    const today = new Date();
    this.financeService.getSummaryForPeriod('day', today).subscribe(summary => {
      this.todaySummary = summary;
    });
    this.financeService.getSummaryForPeriod('week', today).subscribe(summary => {
      this.weekSummary = summary;
    });
    this.financeService.getSummaryForPeriod('month', today).subscribe(summary => {
      this.monthSummary = summary;
    });
  }

  calculateBalance() {
    const entradas = this.transactions
      .filter(t => t.type === 'entrada')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const saidas = this.transactions
      .filter(t => t.type === 'saida')
      .reduce((acc, curr) => acc + curr.amount, 0);

    this.balance = {
      entradas,
      saidas,
      total: entradas - saidas
    };
  }


}