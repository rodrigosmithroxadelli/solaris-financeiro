import { Component, OnInit, inject, Input, DestroyRef } from '@angular/core';
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
  IonButton,
  IonButtons,
  IonIcon,
  ModalController,
  AlertController,
  IonFooter // Added IonFooter
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { carSport } from 'ionicons/icons';
import { Client, Vehicle } from '../../../../models/client.model'; // Corrected import path
import { ClientService } from '../../../../services/client.service'; // Corrected import path
import { of, Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-select-vehicle-modal',
  templateUrl: './select-vehicle-modal.component.html',
  styleUrls: ['./select-vehicle-modal.component.scss'],
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
    IonButton,
    IonButtons,
    IonIcon,
    IonFooter // Added IonFooter
  ]
})
export class SelectVehicleModalComponent implements OnInit {
  @Input() clientId!: string;

  private clientService = inject(ClientService);
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);
  private destroyRef = inject(DestroyRef);

  client: Client | null = null;
  vehicles$: Observable<Vehicle[]> = of([]);
  private hasLoadedClient = false;

  constructor() {
    addIcons({ carSport });
  }

  ngOnInit() {
    if (this.clientId) {
      this.loadClientAndVehicles();
    }
  }

  loadClientAndVehicles() {
    if (this.hasLoadedClient) {
      return;
    }
    this.hasLoadedClient = true;
    this.clientService.getClientById(this.clientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((client: Client | null) => { // Explicitly type client
        this.client = client;
        this.vehicles$ = of(client?.vehicles || []);
      });
  }

  selectVehicle(vehicle: Vehicle) {
    this.modalCtrl.dismiss(vehicle, 'confirm');
  }

  async addNewVehicle() {
    const alert = await this.alertCtrl.create({
      header: 'Novo Veículo',
      inputs: [
        { name: 'plate', type: 'text', placeholder: 'Placa', attributes: { required: true } },
        { name: 'brand', type: 'text', placeholder: 'Marca', attributes: { required: true } },
        { name: 'model', type: 'text', placeholder: 'Modelo', attributes: { required: true } },
        { name: 'color', type: 'text', placeholder: 'Cor', attributes: { required: true } }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Salvar',
          handler: async (data: any) => { // Explicitly type data
            if (!data.plate || !data.brand || !data.model || !data.color) {
              return false; // Validação básica
            }

            const newVehicle: Vehicle = {
              plate: data.plate,
              brand: data.brand,
              model: data.model,
              color: data.color
            };

            if (this.client) {
              const updatedClient: Client = { // Explicitly type updatedClient
                ...this.client,
                vehicles: [...(this.client.vehicles || []), newVehicle]
              };
              await this.clientService.saveClient(updatedClient);
              this.hasLoadedClient = false;
              this.loadClientAndVehicles(); // Recarrega os veículos
              return true;
            }
            return false;
          }
        }
      ]
    });
    await alert.present();
  }

  dismiss() {
    this.modalCtrl.dismiss(null, 'cancel');
  }
}
