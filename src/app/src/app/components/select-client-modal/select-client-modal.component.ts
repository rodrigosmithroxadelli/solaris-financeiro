import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonSearchbar,
  IonButton,
  IonButtons,
  IonIcon,
  ModalController,
  IonFooter // Added IonFooter to the import list
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personAdd } from 'ionicons/icons';
import { Client } from '../../../../models/client.model'; // Corrected import path
import { ClientService } from '../../../../services/client.service'; // Corrected import path
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-select-client-modal',
  templateUrl: './select-client-modal.component.html',
  styleUrls: ['./select-client-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonSearchbar,
    IonButton,
    IonButtons,
    IonIcon,
    IonFooter // Added IonFooter
  ]
})
export class SelectClientModalComponent implements OnInit {
  private clientService = inject(ClientService);
  private modalCtrl = inject(ModalController);
  private destroyRef = inject(DestroyRef);

  clients$: Observable<Client[]> = of([]);
  private allClients: Client[] = [];
  private hasLoadedClients = false;

  constructor() {
    addIcons({ personAdd });
  }

  ngOnInit() {
    this.loadClients();
  }

  loadClients() {
    if (this.hasLoadedClients) {
      return;
    }
    this.hasLoadedClients = true;
    this.clientService.getClients()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((clients: Client[]) => { // Explicitly type clients
        this.allClients = clients;
        this.clients$ = of(this.allClients);
      });
  }

  handleSearch(event: CustomEvent) { // Explicitly type event
    const searchTerm = (event.target as HTMLInputElement).value?.toLowerCase();
    if (searchTerm && searchTerm.trim() !== '') {
      this.clients$ = of(this.allClients.filter(client => 
        client.name.toLowerCase().includes(searchTerm)
      ));
    } else {
      this.clients$ = of(this.allClients);
    }
  }

  selectClient(client: Client) {
    this.modalCtrl.dismiss(client, 'confirm');
  }

  addNewClient() {
    this.modalCtrl.dismiss(null, 'add_new');
  }

  dismiss() {
    this.modalCtrl.dismiss(null, 'cancel');
  }
}
