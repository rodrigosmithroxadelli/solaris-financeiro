import { Component, OnInit, inject, Input } from '@angular/core';
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
  IonInput,
  IonButton,
  IonButtons,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  ModalController,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addCircle, trash, carSport } from 'ionicons/icons';
import { Client, Vehicle } from '../../../../models/client.model';
import { ClientService } from '../../../../services/client.service';
import { AuthService } from '../../../../services/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-client-form-modal',
  templateUrl: './client-form-modal.component.html',
  styleUrls: ['./client-form-modal.component.scss'],
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
    IonInput,
    IonButton,
    IonButtons,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent
  ]
})
export class ClientFormModalComponent implements OnInit {
  @Input() client: Client | null = null;

  private clientService = inject(ClientService);
  private authService = inject(AuthService);
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);

  isEditMode = false;
  clientForm: Partial<Client> = {
    name: '',
    whatsapp: '',
    email: '',
    vehicles: []
  };

  constructor() {
    addIcons({ addCircle, trash, carSport });
  }

  ngOnInit() {
    if (this.client) {
      this.isEditMode = true;
      this.clientForm = { ...this.client };
    }
  }

  async addVehicle() {
    const alert = await this.alertCtrl.create({
      header: 'Novo Veículo',
      inputs: [
        { name: 'plate', type: 'text', placeholder: 'Placa' },
        { name: 'brand', type: 'text', placeholder: 'Marca' },
        { name: 'model', type: 'text', placeholder: 'Modelo' },
        { name: 'color', type: 'text', placeholder: 'Cor' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Adicionar',
          handler: (data) => {
            if (data.plate && data.brand && data.model) {
              const newVehicle: Vehicle = {
                plate: data.plate.toUpperCase(),
                brand: data.brand,
                model: data.model,
                color: data.color
              };
              this.clientForm.vehicles = [...(this.clientForm.vehicles || []), newVehicle];
            }
          }
        }
      ]
    });
    await alert.present();
  }

  removeVehicle(index: number) {
    if (this.clientForm.vehicles) {
      this.clientForm.vehicles.splice(index, 1);
    }
  }

  async save() {
    const currentUser = await firstValueFrom(this.authService.currentUser$);
    if (!currentUser?.tenantId) {
      console.error("Tenant ID not found. Cannot save client.");
      // TODO: Show toast error
      return;
    }

    if (!this.isEditMode) {
      this.clientForm.tenantId = currentUser.tenantId;
    }

    await this.clientService.saveClient(this.clientForm as Client);
    this.modalCtrl.dismiss(this.clientForm, 'save');
  }

  dismiss() {
    this.modalCtrl.dismiss(null, 'cancel');
  }
}
