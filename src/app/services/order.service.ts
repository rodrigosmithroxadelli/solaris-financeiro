import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  Timestamp,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter
} from '@angular/fire/firestore';
import { Observable, of, firstValueFrom, from } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ServiceOrder, PaymentStatus, ServiceStatus, ServicePaymentMethod } from '../models/service-order.model';
import { Transaction } from '../models/transaction.model';
import { DocumentData, QueryDocumentSnapshot, QueryConstraint } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private firestore = inject(Firestore);
  private environmentInjector = inject(EnvironmentInjector);
  private authService = inject(AuthService);
  private readonly PAGE_SIZE = 20;
  private lastDocByTenant = new Map<string, QueryDocumentSnapshot<DocumentData> | null>();
  private hasMoreByTenant = new Map<string, boolean>();

  getOrdersOnce(resetPagination = false): Observable<ServiceOrder[]> {
    return this.authService.currentUser$.pipe(
      take(1),
      switchMap(user => {
        if (!user?.tenantId) {
          return of([]);
        }
        if (resetPagination) {
          this.lastDocByTenant.set(user.tenantId, null);
          this.hasMoreByTenant.set(user.tenantId, true);
        }
        return from(this.loadOrdersPage(user.tenantId));
      })
    );
  }

  hasMoreOrders(tenantId: string): boolean {
    return this.hasMoreByTenant.get(tenantId) ?? false;
  }

  async updatePaymentStatus(orderId: string, status: PaymentStatus) {
    const tenantId = await this.getTenantId();
    const docRef = runInInjectionContext(this.environmentInjector, () =>
      doc(this.firestore, 'empresas', tenantId, 'serviceOrders', orderId)
    );
    await runInInjectionContext(this.environmentInjector, () =>
      updateDoc(docRef, { paymentStatus: status })
    );
  }

  async updateServiceStatus(orderId: string, status: ServiceStatus) {
    const tenantId = await this.getTenantId();
    const docRef = runInInjectionContext(this.environmentInjector, () =>
      doc(this.firestore, 'empresas', tenantId, 'serviceOrders', orderId)
    );
    await runInInjectionContext(this.environmentInjector, () =>
      updateDoc(docRef, { serviceStatus: status, status })
    );
  }

  async cancelOrder(orderId: string) {
    const tenantId = await this.getTenantId();
    const docRef = runInInjectionContext(this.environmentInjector, () =>
      doc(this.firestore, 'empresas', tenantId, 'serviceOrders', orderId)
    );
    await runInInjectionContext(this.environmentInjector, () =>
      updateDoc(docRef, { status: 'CANCELADA', serviceStatus: 'CANCELADA' })
    );
  }

  async deleteOrder(orderId: string) {
    const tenantId = await this.getTenantId();
    const docRef = runInInjectionContext(this.environmentInjector, () =>
      doc(this.firestore, 'empresas', tenantId, 'serviceOrders', orderId)
    );
    await runInInjectionContext(this.environmentInjector, () =>
      deleteDoc(docRef)
    );
  }

  async syncOrdersFromTransactions(transactions: Transaction[]) {
    const tenantId = await this.getTenantId();
    const ordersCollection = runInInjectionContext(this.environmentInjector, () =>
      collection(this.firestore, 'empresas', tenantId, 'serviceOrders')
    );
    let changed = false;
    for (const transaction of transactions) {
      if (transaction.type !== 'entrada' || transaction.serviceOrderId || !transaction.id) {
        continue;
      }
      if (transaction.paymentStatus === 'PAGO') {
        continue;
      }
      const paymentStatus: PaymentStatus = transaction.paymentStatus ?? 'PENDENTE';
      const createdAt = transaction.date ? Timestamp.fromDate(new Date(transaction.date)) : Timestamp.now();
      const orderPayload: Partial<ServiceOrder> = {
        tenantId,
        number: 0,
        clientId: '',
        clientName: transaction.clientName || '',
        vehicle: { plate: '', brand: '', model: '', color: '' },
        status: 'OPEN',
        paymentStatus,
        paymentMethod: this.mapPaymentMethod(transaction.paymentMethod),
        serviceValue: transaction.amount,
        checklist: { fuelLevel: 0, notes: '', photosUrls: [] },
        items: [],
        financial: {
          subtotal: transaction.amount,
          globalDiscount: 0,
          totalPrice: transaction.amount,
          payments: [],
          balanceDue: transaction.amount
        },
        timestamps: { created: createdAt }
      };
      const orderRef = await runInInjectionContext(this.environmentInjector, () =>
        addDoc(ordersCollection, orderPayload as ServiceOrder)
      );
      const transactionRef = runInInjectionContext(this.environmentInjector, () =>
        doc(this.firestore, 'empresas', tenantId, 'lancamentos', transaction.id!)
      );
      await runInInjectionContext(this.environmentInjector, () =>
        updateDoc(transactionRef, {
          serviceOrderId: orderRef.id,
          paymentStatus
        })
      );
      changed = true;
    }
    return changed;
  }

  private async getTenantId(): Promise<string> {
    const user = await firstValueFrom(this.authService.currentUser$);
    if (!user?.tenantId) {
      throw new Error('Tenant ID não encontrado.');
    }
    return user.tenantId;
  }

  private async loadOrdersPage(tenantId: string): Promise<ServiceOrder[]> {
    const hasMore = this.hasMoreByTenant.get(tenantId) ?? true;
    if (!hasMore) {
      return [];
    }
    const ordersCollection = runInInjectionContext(this.environmentInjector, () =>
      collection(this.firestore, 'empresas', tenantId, 'serviceOrders')
    );
    const lastDoc = this.lastDocByTenant.get(tenantId) ?? null;
    const constraints: QueryConstraint[] = [orderBy('__name__'), limit(this.PAGE_SIZE)];
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }
    const q = query(ordersCollection, ...constraints);
    const snapshot = await runInInjectionContext(this.environmentInjector, () => getDocs(q));
    const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : lastDoc;
    this.lastDocByTenant.set(tenantId, newLastDoc ?? null);
    this.hasMoreByTenant.set(tenantId, snapshot.docs.length === this.PAGE_SIZE);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as ServiceOrder) }));
  }

  private mapPaymentMethod(method: Transaction['paymentMethod']): ServicePaymentMethod {
    switch (method) {
      case 'cartao_credito':
        return 'credito';
      case 'cartao_debito':
        return 'debito';
      case 'pix':
        return 'pix';
      case 'dinheiro':
        return 'dinheiro';
      case 'boleto':
        return 'boleto';
      case 'transferencia':
        return 'transferencia';
      default:
        return 'dinheiro';
    }
  }
}
