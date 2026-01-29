import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavController, ModalController, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent, IonList, IonItem, IonAvatar, IonLabel } from '@ionic/angular/standalone'; // Added ModalController
import { ClientService } from '../../services/client.service';
import { AuthService } from '../../services/auth.service';
import { Client } from '../../models/client.model';
import { addIcons } from 'ionicons';
import { add, create } from 'ionicons/icons'; // Added create icon for edit
import { ClientFormModalComponent } from '../../src/app/components/client-form-modal/client-form-modal.component'; // Import the new modal

@Component({
  selector: 'app-clients',
  templateUrl: './clients.page.html',
  styleUrls: ['./clients.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent, IonList, IonItem, IonAvatar, IonLabel]
})
export class ClientsPage implements OnInit {
  private clientService = inject(ClientService);
  private modalCtrl = inject(ModalController);
  private navCtrl = inject(NavController);
  
  clients: Client[] = [];

  constructor() { 
    addIcons({ add, create });
  }

  ngOnInit() {
    this.loadClients();
  }

  async loadClients() {
    // No need for 'await' here, getClients returns an Observable
    this.clientService.getClients().subscribe(data => {
      this.clients = data.sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  // Vai para detalhes
  openClient(client: Client) {
    // This can be the click action for the whole item
    this.navCtrl.navigateForward(`/app/client-detail/${client.id}`);
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
      this.loadClients();
    }
  }
}
