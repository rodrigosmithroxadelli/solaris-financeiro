import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonIcon,
  IonSegment,
  IonSegmentButton
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { barChartOutline, cashOutline, statsChartOutline, trendingUpOutline } from 'ionicons/icons';
import { FormattingService } from '../services/formatting.service';
import { FinanceiroService } from '../services/financeiro.service';

@Component({
  selector: 'app-financeiro',
  templateUrl: 'financeiro.page.html',
  styleUrls: ['financeiro.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonIcon,
    IonSegment,
    IonSegmentButton
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FinanceiroPage {
  formattingService = inject(FormattingService);
  financeiroService = inject(FinanceiroService);

  activeTab: 'caixa' | 'projecao' | 'resultado' = 'caixa';
  constructor() {
    addIcons({ barChartOutline, cashOutline, statsChartOutline, trendingUpOutline });
  }
}
