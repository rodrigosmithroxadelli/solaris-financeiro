import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent, IonCard, IonCardContent, IonList, IonItem, IonLabel, IonNote, IonButton, IonIcon } from '@ionic/angular/standalone';
import { ActivatedRoute } from '@angular/router';
import { ClientService } from '../../services/client.service';
import { FinanceService } from '../../services/finance.service'; // Para pegar transações
import { PdfService } from '../../services/pdf.service';
import { Client } from '../../models/client.model';
import { Transaction } from '../../models/transaction.model';
import { addIcons } from 'ionicons';
import { documentTextOutline } from 'ionicons/icons';
import { combineLatest, of, shareReplay } from 'rxjs'; // Add combineLatest, of
import { switchMap, filter, map } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service'; // Import AuthService
import { User } from '../../models/user.model'; // Import User model
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-client-detail',
  templateUrl: './client-detail.page.html',
  styleUrls: ['./client-detail.page.scss'],
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent, IonCard, IonCardContent, IonList, IonItem, IonLabel, IonNote, IonButton, IonIcon]
})
export class ClientDetailPage implements OnInit {
  client: Client | null = null;
  history: Transaction[] = [];
  hasLoadedHistory = false;
  
  private route = inject(ActivatedRoute);
  private clientService = inject(ClientService);
  private financeService = inject(FinanceService);
  private pdfService = inject(PdfService);
  private authService = inject(AuthService); // Inject AuthService
  private destroyRef = inject(DestroyRef);

  constructor() {
    addIcons({ documentTextOutline });
  }

  ngOnInit() {
    const client$ = this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id');
        if (!id) {
          return of(null); // No ID, return observable of null
        }
        // Combine currentUser$ with getClientById(id)
        return combineLatest([
          this.authService.currentUser$,
          this.clientService.getClientById(id)
        ]).pipe(
          map(([user, client]: [User | null, Client | {} | null]) => { // client here is already Client | {}
              if (user && user.tenantId && client && 'tenantId' in client && client.tenantId === user.tenantId) {
                  return client;
              }
              return null; // Return null if user/client not found or tenantId mismatch
          }),
          filter((client): client is Client => !!client) // Ensure client is not null and is type Client before proceeding
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    client$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(client => {
        this.client = client;
      });

    combineLatest([client$, this.financeService.transactions$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([client, transactions]) => {
        if (client) {
          this.history = transactions.filter(t => t.clientName === client.name);
          this.hasLoadedHistory = true;
        } else {
          this.history = [];
        }
      });
  }

  generateReceipt(transaction: Transaction) {
    if (this.client) {
      this.pdfService.generateReceiptPdf(transaction);
    }
  }
}
