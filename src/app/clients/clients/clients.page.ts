import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalController, IonButton, IonIcon, IonContent, IonList, IonItem, IonLabel } from '@ionic/angular/standalone';
import { ClientService } from '../../services/client.service';
import { Client } from '../../models/client.model';
import { addIcons } from 'ionicons';
import { add, create, peopleOutline } from 'ionicons/icons'; // Added create icon for edit
import { ClientFormModalComponent } from '../../src/app/components/client-form-modal/client-form-modal.component'; // Import the new modal
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-clients',
  templateUrl: './clients.page.html',
  styleUrls: ['./clients.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonIcon, IonContent, IonList, IonItem, IonLabel]
})
export class ClientsPage implements OnInit {
  private clientService = inject(ClientService);
  private modalCtrl = inject(ModalController);
  private destroyRef = inject(DestroyRef);
  
  clients: Client[] = [];
  private hasLoadedClients = false;

  constructor() { 
    addIcons({ add, create, peopleOutline });
  }

  ngOnInit() {
    this.loadClients();
  }

  async loadClients() {
    if (this.hasLoadedClients) {
      return;
    }
    this.hasLoadedClients = true;
    // No need for 'await' here, getClients returns an Observable
    this.clientService.getClients()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => {
        this.clients = data.sort((a, b) => a.name.localeCompare(b.name));
      });
  }

  // Opens modal for adding or editing a client
  async openClientFormModal(client: Client | null = null) {
    const modal = await this.modalCtrl.create({
      component: ClientFormModalComponent,
      componentProps: {
        client: client // Pass client data if editing, otherwise null
      }
    });

    await modal.present();

    const { data, role } = await modal.onDidDismiss();

    // Reload clients if a save was successful
    if (role === 'save') {
      this.hasLoadedClients = false;
      this.loadClients();
    }
  }
}
