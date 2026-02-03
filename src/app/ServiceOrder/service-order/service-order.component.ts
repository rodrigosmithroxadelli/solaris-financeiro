import { Component, inject, OnInit, OnDestroy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  ToastController,
  AlertController,
  IonBadge,
  IonToggle,
  IonGrid,
  IonRow,
  IonCol
} from '@ionic/angular/standalone';
import { OrderService } from '../../services/order.service';
import { PaymentService } from '../../services/payment.service';
import { FinanceService } from '../../services/finance.service';
import { AuthService } from '../../services/auth.service'; // Import AuthService
import { User } from '../../models/user.model'; // Import User
import { ServiceOrder, ServiceStatus } from '../../models/service-order.model';
import { addIcons } from 'ionicons';
import { trash, cashOutline, close, checkmark } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
 

@Component({
  selector: 'app-service-order',
  templateUrl: './service-order.component.html',
  styleUrls: ['./service-order.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonBadge,
    IonToggle,
    IonGrid,
    IonRow,
    IonCol
  ]
})
export class ServiceOrderComponent implements OnInit, OnDestroy {
  private orderService = inject(OrderService);
  private paymentService = inject(PaymentService);
  private financeService = inject(FinanceService);
  private authService = inject(AuthService);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);
  private destroyRef = inject(DestroyRef);

  currentUser: User | null = null;
  
  allOrders: ServiceOrder[] = [];
  private ordersSnapshot: ServiceOrder[] = [];
  private subscriptions = new Subscription();
  private hasLoadedOrders = false;
  onlyPending = true;

  constructor() {
    addIcons({ trash, cashOutline, close, checkmark });
  }

  ngOnInit() {
    const authSub = this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(user => {
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

    if (!this.hasLoadedOrders) {
      this.hasLoadedOrders = true;
      const ordersSub = this.orderService.getOrdersOnce(true).subscribe(orders => {
        this.ordersSnapshot = orders;
        this.applyOrderFilters();
      });
      this.subscriptions.add(ordersSub);
    }
    if (this.currentUser?.tenantId) {
      this.financeService.transactions$
        .pipe(takeUntilDestroyed(this.destroyRef), take(1))
        .subscribe(async transactions => {
          const changed = await this.orderService.syncOrdersFromTransactions(transactions);
          if (changed) {
            this.showToast('OS atualizadas com lançamentos pendentes', 'success');
          }
        });
    }
  }


  onPendingToggle() {
    this.applyOrderFilters();
  }

  private applyOrderFilters() {
    const filtered = this.ordersSnapshot
      .filter(order => order.status !== 'CANCELADA')
      .filter(order => !this.onlyPending || (order.paymentStatus ?? 'PENDENTE') === 'PENDENTE')
      .sort((a, b) => {
        const timeA = a.timestamps?.created?.toMillis() || 0;
        const timeB = b.timestamps?.created?.toMillis() || 0;
        return timeB - timeA;
      });
    this.allOrders = filtered;
  }

  async togglePaymentStatus(order: ServiceOrder, event: any) {
    const previousStatus = order.paymentStatus ?? 'PENDENTE';
    const isChecked = event?.detail?.checked ?? previousStatus !== 'PAGO';
    const newStatus: ServiceOrder['paymentStatus'] = isChecked ? 'PAGO' : 'PENDENTE';
    if (previousStatus === newStatus) {
      return;
    }
    try {
      await this.orderService.updatePaymentStatus(order.id!, newStatus);
      if (order.linkedTransactionId) {
        await this.paymentService.updateTransactionPaymentStatus(order.linkedTransactionId, newStatus);
      } else if (order.id) {
        await this.paymentService.updateTransactionPaymentStatusByServiceOrderId(order.id, newStatus);
      }
      this.updateLocalPaymentStatus(order.id!, newStatus);
      await this.showToast('Status de pagamento atualizado!', 'success');
    } catch (error) {
      this.updateLocalPaymentStatus(order.id!, previousStatus);
      await this.showToast('Erro ao atualizar pagamento', 'danger');
    }
  }

  async setServiceStatus(order: ServiceOrder, status: ServiceStatus) {
    try {
      await this.orderService.updateServiceStatus(order.id!, status);
      await this.showToast('Status do serviço atualizado!', 'success');
    } catch (error) {
      await this.showToast('Erro ao atualizar status do serviço', 'danger');
    }
  }

  async confirmDeleteOrder(order: ServiceOrder) {
    const alert = await this.alertController.create({
      header: 'Confirmar exclusão',
      message: 'A Ordem de Serviço será removida. Lançamentos vinculados poderão ser excluídos.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          role: 'destructive',
          handler: () => this.deleteOrder(order)
        }
      ]
    });
    await alert.present();
  }

  private async deleteOrder(order: ServiceOrder) {
    try {
      if (order.paymentStatus === 'PENDENTE') {
        if (order.linkedTransactionId) {
          await this.paymentService.deleteTransaction(order.linkedTransactionId);
        }
        await this.orderService.deleteOrder(order.id!);
        await this.showToast('Ordem removida com sucesso!', 'success');
      } else {
        await this.orderService.cancelOrder(order.id!);
        await this.showToast('Ordem cancelada com sucesso!', 'success');
      }
    } catch (error) {
      await this.showToast('Erro ao remover ordem', 'danger');
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

  private updateLocalPaymentStatus(orderId: string, status: ServiceOrder['paymentStatus']) {
    const orderIndex = this.ordersSnapshot.findIndex(order => order.id === orderId);
    if (orderIndex !== -1) {
      this.ordersSnapshot[orderIndex] = { ...this.ordersSnapshot[orderIndex], paymentStatus: status };
    }
    const visibleOrder = this.allOrders.find(order => order.id === orderId);
    if (visibleOrder) {
      visibleOrder.paymentStatus = status;
    }
    this.applyOrderFilters();
  }

  getServiceStatusLabel(order: ServiceOrder): string {
    const status = order.serviceStatus || order.status || 'AGUARDANDO_ACAO';
    switch (status) {
      case 'AGUARDANDO_ACAO':
        return 'AGUARDANDO AÇÃO';
      case 'CONCLUIDA':
        return 'CONCLUÍDA';
      case 'CANCELADA':
        return 'CANCELADA';
      default:
        return status.replace('_', ' ');
    }
  }

  getPaymentMethodLabel(order: ServiceOrder): string {
    switch (order.paymentMethod) {
      case 'dinheiro':
        return 'Dinheiro';
      case 'pix':
        return 'PIX';
      case 'debito':
        return 'Débito';
      case 'credito':
        return 'Crédito';
      case 'boleto':
        return 'Boleto';
      case 'transferencia':
        return 'Transferência';
      default:
        return '---';
    }
  }
}
