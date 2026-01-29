import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonInput,
  IonGrid,
  IonRow,
  IonCol,
  IonButtons,
  ModalController,
  ToastController,
  IonNote // Added IonNote here
} from '@ionic/angular/standalone';
import { OrderManagerService } from '../../services/order-manager.service';
import { AuthService } from '../../services/auth.service'; // Import AuthService
import { User } from '../../models/user.model'; // Import User
import { OrderItem, Client, Vehicle, Payment, ServiceOrder } from '../../models/service-order.model';
import { addIcons } from 'ionicons';
import { Router } from '@angular/router';
import { save, refresh, addCircle, trash, personCircleOutline, carOutline, walletOutline } from 'ionicons/icons';
import { SelectItemModalComponent } from '../../components/select-item-modal/select-item-modal.component';
import { SelectClientModalComponent } from '../../src/app/components/select-client-modal/select-client-modal.component';
import { SelectVehicleModalComponent } from '../../src/app/components/select-vehicle-modal/select-vehicle-modal.component';
import { PaymentDialogComponent } from '../../Payment/payment-dialog/payment-dialog.component';
import { CatalogItem } from '../../models/catalog.model';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-service-order',
  templateUrl: './service-order.component.html',
  styleUrls: ['./service-order.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonInput,
    IonGrid,
    IonRow,
    IonCol,
    IonButtons,
    IonNote // Added IonNote
  ]
})
export class ServiceOrderComponent implements OnInit, OnDestroy {
  orderManager = inject(OrderManagerService);
  private authService = inject(AuthService);
  private modalCtrl = inject(ModalController);
  private router = inject(Router);
  private toastController = inject(ToastController);

  currentUser: User | null = null;
  
  currentOrder = this.orderManager.currentOrder;
  subtotal = this.orderManager.subtotal;
  totalPrice = this.orderManager.totalPrice;
  totalPaid = this.orderManager.totalPaid;
  balanceDue = this.orderManager.balanceDue;

  allOrders: ServiceOrder[] = [];
  private subscriptions = new Subscription();

  constructor() {
    addIcons({ save, refresh, addCircle, trash, personCircleOutline, carOutline, walletOutline });
  }

  ngOnInit() {
    const authSub = this.authService.currentUser$.subscribe(user => {
      if (user && user.tenantId) {
        this.currentUser = user;
        this.loadDataForUser(user);
      } else {
        this.currentUser = null;
        this.allOrders = [];
      }
    });
    this.subscriptions.add(authSub);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  loadDataForUser(user: User) {
    if (!user.tenantId) return;

    // Load initial empty order form
    this.orderManager.resetCurrentOrder(user.tenantId);

    // Load the list of all orders
    const ordersSub = this.orderManager.getOrders(user.tenantId).subscribe(orders => {
      this.allOrders = orders.sort((a, b) => {
        const timeA = a.timestamps?.created?.toMillis() || 0;
        const timeB = b.timestamps?.created?.toMillis() || 0;
        return timeB - timeA;
      });
    });
    this.subscriptions.add(ordersSub);
  }

  selectOrder(order: ServiceOrder) {
    this.orderManager.setCurrentOrder(order);
  }

  async handleSaveOrder() {
    // Ensure tenantId is set on the order before saving
    if (!this.currentOrder().tenantId && this.currentUser?.tenantId) {
      this.orderManager.currentOrder.update(order => ({ ...order, tenantId: this.currentUser!.tenantId }));
    }
    
    const success = await this.orderManager.saveOrder();
    if (success) {
      this.showToast('Ordem salva com sucesso!', 'success');
      // The real-time listener from getOrders will update the list automatically.
      // We also reset the form to a new draft.
      this.orderManager.resetCurrentOrder(this.currentUser!.tenantId);
    } else {
      this.showToast('Falha ao salvar a ordem.', 'danger');
    }
  }

  handleResetOrder() {
    if (this.currentUser?.tenantId) {
      this.orderManager.resetCurrentOrder(this.currentUser.tenantId);
      this.showToast('Formulário limpo!', 'success');
    }
  }

  // --- UI Handler Methods ---

  async openClientSelectionModal() {
    const modal = await this.modalCtrl.create({ component: SelectClientModalComponent });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<Client>();

    if (role === 'confirm' && data) {
      this.orderManager.currentOrder.update(order => ({
        ...order,
        clientId: data.id!,
        clientName: data.name,
        vehicle: data.vehicles.length > 0 ? data.vehicles[0] : { plate: '', brand: '', model: '', color: '' } 
      }));
      if (data.vehicles.length === 0) this.openVehicleSelectionModal();
    } else if (role === 'add_new') {
      this.router.navigate(['/clients']);
    }
  }

  async openVehicleSelectionModal() {
    const currentClient = this.orderManager.currentOrder().clientId;
    if (!currentClient) {
      this.showToast('Selecione um cliente primeiro.', 'warning');
      return;
    }

    const modal = await this.modalCtrl.create({
      component: SelectVehicleModalComponent,
      componentProps: { clientId: currentClient }
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<Vehicle>();

    if (role === 'confirm' && data) {
      this.orderManager.currentOrder.update(order => ({ ...order, vehicle: data }));
    }
  }

  async openSelectItemModal() {
    const modal = await this.modalCtrl.create({ component: SelectItemModalComponent });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<CatalogItem>();

    if (role === 'confirm' && data) {
      const newItem: OrderItem = {
        id: data.id!, type: data.type, name: data.name, quantity: 1,
        unitPrice: data.unitPrice, costPrice: data.costPrice || 0, discount: 0,
        total: data.unitPrice,
      };
      this.orderManager.addItem(newItem);
    }
  }

  async handleCheckout() {
    const pendingAmount = this.orderManager.balanceDue();
    if (pendingAmount <= 0) {
      this.showToast('Não há valor pendente para pagamento.', 'warning');
      return;
    }

    const modal = await this.modalCtrl.create({
      component: PaymentDialogComponent,
      componentProps: { pendingAmount: pendingAmount }
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<Partial<Payment>>();

    if (role === 'confirm' && data && data.grossValue && data.grossValue > 0) {
      this.orderManager.addPayment(
        data.grossValue, data.taxRate || 0, data.method || 'CASH', data.installments || 1
      );
      this.showToast('Pagamento adicionado com sucesso!', 'success');
    }
  }

  handleRemoveItem(itemId: string) {
    this.orderManager.removeItem(itemId);
  }

  handleUpdateQuantity(itemId: string, event: any) {
    const newQuantity = (event.target as HTMLInputElement).valueAsNumber;
    if (!isNaN(newQuantity) && newQuantity > 0) {
      this.orderManager.updateItemQuantity(itemId, newQuantity);
    }
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