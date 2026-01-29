import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonFab,
  IonFabButton,
  IonModal,
  IonButtons,
  IonInput,
  ToastController,
  AlertController,
  IonBackButton // Added IonBackButton to the import list
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, create, trash } from 'ionicons/icons';
import { CatalogItem } from '../../../../models/catalog.model'; // Corrected import path
import { CatalogService } from '../../../../services/catalog.service'; // Corrected import path

@Component({
  selector: 'app-catalog-management',
  templateUrl: './catalog-management.page.html',
  styleUrls: ['./catalog-management.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    CommonModule,
    FormsModule,
    IonList,
    IonItem,
    IonLabel,
    IonButton,
    IonIcon,
    IonFab,
    IonFabButton,
    IonModal,
    IonButtons,
    IonInput,
    IonBackButton // Added IonBackButton
  ]
})
export class CatalogManagementPage implements OnInit {
  private catalogService = inject(CatalogService);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  catalogItems: CatalogItem[] = [];
  isModalOpen = false;
  editingItem: CatalogItem | null = null;
  formItem: Partial<CatalogItem> = {};

  constructor() {
    addIcons({ add, create, trash });
  }

  ngOnInit() {
    this.loadItems();
  }

  loadItems() {
    this.catalogService.getCatalogItems().subscribe((items: CatalogItem[]) => { // Explicitly type items
      this.catalogItems = items.sort((a: CatalogItem, b: CatalogItem) => a.name.localeCompare(b.name)); // Explicitly type a and b
    });
  }

  openItemModal(item: CatalogItem | null = null) {
    if (item) {
      this.editingItem = item;
      this.formItem = { ...item };
    } else {
      this.editingItem = null;
      this.formItem = {
        name: '',
        type: 'SERVICE', // Padrão para 'SERVICE' conforme o MVP
        unitPrice: 0
      };
    }
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.editingItem = null;
    this.formItem = {};
  }

  async saveItem() {
    if (!this.formItem.name || this.formItem.unitPrice == null || this.formItem.unitPrice < 0) {
      this.showToast('Por favor, preencha o nome e um preço válido.', 'warning');
      return;
    }

    try {
      await this.catalogService.saveCatalogItem(this.formItem as CatalogItem);
      this.showToast(`Item ${this.editingItem ? 'atualizado' : 'criado'} com sucesso!`, 'success');
      this.closeModal();
    } catch (error: any) { // Explicitly type error as any
      console.error('Erro ao salvar item do catálogo:', error);
      this.showToast('Erro ao salvar item.', 'danger');
    }
  }

  async deleteItem(item: CatalogItem) {
    if (!item.id) return;

    const alert = await this.alertController.create({
      header: 'Confirmar Exclusão',
      message: `Tem certeza que deseja excluir "${item.name}"?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Excluir',
          role: 'destructive',
          handler: async () => {
            try {
              if (item.id) {
                await this.catalogService.deleteCatalogItem(item.id);
                this.showToast('Item excluído com sucesso!', 'success');
              }
            } catch (error: any) { // Explicitly type error as any
              console.error('Erro ao excluir item do catálogo:', error);
              this.showToast('Erro ao excluir item.', 'danger');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'top'
    });
    await toast.present();
  }
}
