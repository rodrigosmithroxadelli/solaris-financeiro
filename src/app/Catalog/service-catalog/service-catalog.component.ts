// src/app/Catalog/service-catalog/service-catalog.component.ts
import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonList,
  IonBadge,
  IonFab,
  IonFabButton,
  IonSearchbar,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonTextarea,
  IonButtons,
  ToastController,
  AlertController
} from '@ionic/angular/standalone';
import { CatalogService } from '../../services/catalog.service';
import { AuthService } from '../../services/auth.service';
import { CatalogItem } from '../../models/catalog.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { addIcons } from 'ionicons';
import { add, create, trash, close, checkmark } from 'ionicons/icons';

@Component({
  selector: 'app-service-catalog',
  templateUrl: './service-catalog.component.html',
  styleUrls: ['./service-catalog.component.scss'],
  standalone: true,
  providers: [ToastController, AlertController],
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonList,
    IonBadge,
    IonFab,
    IonFabButton,
    IonSearchbar,
    IonModal,
    IonSelect,
    IonSelectOption,
    IonInput,
    IonButtons
  ]
})
export class ServiceCatalogComponent implements OnInit {
  catalogService = inject(CatalogService);
  authService = inject(AuthService);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);
  private destroyRef = inject(DestroyRef);

  catalogItems: CatalogItem[] = [];
  filteredItems: CatalogItem[] = [];
  searchTerm: string = '';
  selectedType: 'ALL' | 'SERVICE' | 'PRODUCT' = 'ALL';
  private hasLoadedCatalog = false;

  // Modal properties
  showItemModal = false;
  isEditMode = false;
  formItem: CatalogItem = {
    tenantId: '',
    name: '',
    type: 'SERVICE',
    unitPrice: 0,
    costPrice: 0
  };

  constructor() {
    addIcons({ add, create, trash, close, checkmark });
  }

  ngOnInit() {
    this.loadCatalogItems();
  }

  /**
   * Load catalog items and subscribe to real-time updates
   */
  loadCatalogItems() {
    if (this.hasLoadedCatalog) {
      return;
    }
    this.hasLoadedCatalog = true;
    console.log('ServiceCatalogComponent.loadCatalogItems() - iniciando...');
    this.catalogService.getCatalogItems()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: (items) => {
        console.log('ServiceCatalogComponent: Items carregados:', items);
        this.catalogItems = items;
        this.applyFilters();
      },
      error: (error) => {
        console.error('ServiceCatalogComponent: Erro ao carregar items:', error);
        this.showToast('Erro ao carregar itens do catálogo', 'danger');
      }
    });
  }

  /**
   * Apply search and type filters
   */
  applyFilters() {
    let filtered = [...this.catalogItems];

    // Filter by type
    if (this.selectedType !== 'ALL') {
      filtered = filtered.filter(item => item.type === this.selectedType);
    }

    // Filter by search term
    if (this.searchTerm.trim()) {
      const lowerSearch = this.searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(lowerSearch)
      );
    }

    // Sort by name
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    this.filteredItems = filtered;
  }

  /**
   * Handle search input change
   */
  onSearchChange(event: any) {
    this.searchTerm = event.detail.value;
    this.applyFilters();
  }

  /**
   * Handle type filter change
   */
  onTypeChange(event: any) {
    this.selectedType = event.detail.value;
    this.applyFilters();
  }

  /**
   * Open modal to add new item
   */
  openAddItemModal() {
    console.log('openAddItemModal() chamado');
    this.isEditMode = false;
    this.formItem = {
      tenantId: '',
      name: '',
      type: 'SERVICE',
      unitPrice: 0,
      costPrice: 0
    };
    this.showItemModal = true;
    console.log('showItemModal definido para true');
  }

  /**
   * Open modal to edit existing item
   */
  openEditItemModal(item: CatalogItem) {
    this.isEditMode = true;
    this.formItem = { ...item };
    this.showItemModal = true;
  }

  /**
   * Close modal
   */
  closeItemModal() {
    this.showItemModal = false;
  }

  /**
   * Save item (create or update)
   */
  async saveItem() {
    // Validate form
    if (!this.formItem.name || this.formItem.name.trim().length < 2) {
      await this.showToast('Nome deve ter pelo menos 2 caracteres', 'warning');
      return;
    }

    if (this.formItem.unitPrice <= 0) {
      await this.showToast('Preço de venda deve ser maior que zero', 'warning');
      return;
    }

    if (this.formItem.costPrice && this.formItem.costPrice < 0) {
      await this.showToast('Preço de custo não pode ser negativo', 'warning');
      return;
    }

    try {
      await this.catalogService.saveCatalogItem(this.formItem);
      const action = this.isEditMode ? 'atualizado' : 'criado';
      await this.showToast(`Item ${action} com sucesso!`, 'success');
      this.closeItemModal();
      this.hasLoadedCatalog = false;
      this.loadCatalogItems();
    } catch (error) {
      console.error('Error saving item:', error);
      await this.showToast('Erro ao salvar item', 'danger');
    }
  }

  /**
   * Delete item with confirmation
   */
  async deleteItem(item: CatalogItem) {
    if (!item.id) return;

    const alert = await this.alertController.create({
      header: 'Confirmar exclusão',
      message: `Deseja realmente excluir "${item.name}"?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Excluir',
          role: 'destructive',
          handler: async () => {
            try {
              await this.catalogService.deleteCatalogItem(item.id!);
              await this.showToast('Item excluído com sucesso', 'success');
            } catch (error) {
              console.error('Error deleting item:', error);
              await this.showToast('Erro ao excluir item', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Format currency for display
   */
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  /**
   * Get type badge color
   */
  getTypeBadgeColor(type: string): string {
    return type === 'SERVICE' ? 'primary' : 'success';
  }

  /**
   * Get type display label
   */
  getTypeLabel(type: string): string {
    return type === 'SERVICE' ? 'Serviço' : 'Produto';
  }

  /**
   * Show toast notification
   */
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
