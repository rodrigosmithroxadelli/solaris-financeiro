import { Injectable, signal, computed, effect, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { ServiceOrder, OrderItem, Payment, Vehicle } from '../models/service-order.model';
import { Firestore, collection, doc, addDoc, updateDoc, deleteDoc, getDoc, query, Timestamp, getDocs, limit, startAfter, orderBy } from '@angular/fire/firestore';
import { Observable, of, shareReplay, from } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class OrderManagerService {
  private readonly TENANT_COLLECTION = 'tenants';
  private readonly ORDERS_COLLECTION = 'serviceOrders';

  private firestore = inject(Firestore);
  private environmentInjector = inject(EnvironmentInjector);
  private ordersCache = new Map<string, Observable<ServiceOrder[]>>();
  private readonly PAGE_SIZE = 20;
  private ordersLastDocByTenant = new Map<string, QueryDocumentSnapshot<DocumentData> | null>();
  private ordersHasMoreByTenant = new Map<string, boolean>();

  currentOrder = signal<ServiceOrder>({
    tenantId: '',
    number: 0,
    clientId: '',
    clientName: '',
    vehicle: { plate: '', brand: '', model: '', color: '' },
    status: 'DRAFT',
    checklist: { fuelLevel: 0, notes: '', photosUrls: [] },
    items: [],
    financial: { subtotal: 0, globalDiscount: 0, totalPrice: 0, payments: [], balanceDue: 0 },
    timestamps: { created: Timestamp.now() }
  });

  subtotal = computed(() => this.currentOrder().items.reduce((acc, item) => acc + item.total, 0));
  totalPrice = computed(() => this.subtotal() - this.currentOrder().financial.globalDiscount);
  totalPaid = computed(() => this.currentOrder().financial.payments.reduce((acc, payment) => acc + payment.netValue, 0));
  balanceDue = computed(() => this.totalPrice() - this.totalPaid());

  constructor() {
    // Financial computations are handled by computed signals.
    // The effect to update them back to the order was causing an infinite loop.
  }

  getOrders(tenantId: string): Observable<ServiceOrder[]> {
    if (!tenantId) {
      console.error('OrderManagerService: Cannot get orders, tenantId is missing.');
      return of([]);
    }
    const cached = this.ordersCache.get(tenantId);
    if (cached) {
      void this.loadNextOrdersPage(tenantId);
      return cached;
    }
    console.log(`[OrderManagerService] getting orders for tenant: ${tenantId}`);
    const orders$ = from(this.loadNextOrdersPage(tenantId)).pipe(
      tap(orders => console.log('[OrderManagerService] Orders received from Firestore:', orders)),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.ordersCache.set(tenantId, orders$);
    return orders$;
  }

  setCurrentOrder(order: ServiceOrder) {
    this.currentOrder.set(order);
  }

  resetCurrentOrder(tenantId: string) {
    this.currentOrder.set({
      tenantId: tenantId,
      number: 0,
      clientId: '',
      clientName: '',
      vehicle: { plate: '', brand: '', model: '', color: '' },
      status: 'DRAFT',
      checklist: { fuelLevel: 0, notes: '', photosUrls: [] },
      items: [],
      financial: { subtotal: 0, globalDiscount: 0, totalPrice: 0, payments: [], balanceDue: 0 },
      timestamps: { created: Timestamp.now() }
    });
  }

  addItem(newItem: OrderItem) {
    this.currentOrder.update(order => ({ ...order, items: [...order.items, newItem] }));
  }

  removeItem(itemId: string) {
    this.currentOrder.update(order => ({ ...order, items: order.items.filter(item => item.id !== itemId) }));
  }

  updateItemQuantity(itemId: string, newQuantity: number) {
    this.currentOrder.update(order => ({
      ...order,
      items: order.items.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity, total: item.unitPrice * newQuantity - item.discount } : item
      )
    }));
  }

  addPayment(grossValue: number, taxRate: number, method: Payment['method'], installments: number = 1, dueDate: Timestamp = Timestamp.now()) {
    const netValue = method === 'CREDIT_CARD' || method === 'DEBIT_CARD'
      ? grossValue * (1 - taxRate / 100)
      : grossValue;
    const newPayment: Payment = { method, installments, grossValue, taxRate, netValue, dueDate };
    this.currentOrder.update(order => ({
      ...order,
      financial: { ...order.financial, payments: [...order.financial.payments, newPayment] }
    }));
  }

  async saveOrder() {
    const order = this.currentOrder();
    if (!order.tenantId) {
      console.error('Cannot save order: tenantId is missing.');
      return;
    }

    const ordersCollection = runInInjectionContext(this.environmentInjector, () =>
      collection(this.firestore, this.TENANT_COLLECTION, order.tenantId, this.ORDERS_COLLECTION)
    );

    try {
      if (order.id) {
        const docRef = runInInjectionContext(this.environmentInjector, () =>
          doc(ordersCollection, order.id)
        );
        await runInInjectionContext(this.environmentInjector, () =>
          updateDoc(docRef, { ...order, timestamps: { ...order.timestamps, finished: Timestamp.now() } })
        );
        console.log('Order updated successfully:', order.id);
      } else {
        const newDocRef = await runInInjectionContext(this.environmentInjector, () =>
          addDoc(ordersCollection, { ...order, timestamps: { ...order.timestamps, created: Timestamp.now() } })
        );
        this.currentOrder.update(prevOrder => ({ ...prevOrder, id: newDocRef.id }));
        console.log('New order created successfully with ID:', newDocRef.id);
      }
      this.ordersCache.delete(order.tenantId);
      this.ordersLastDocByTenant.delete(order.tenantId);
      this.ordersHasMoreByTenant.delete(order.tenantId);
      return true;
    } catch (error) {
      console.error('Error saving order:', error);
      return false;
    }
  }

  async loadOrder(orderId: string, tenantId: string) {
    if (!tenantId) {
      console.error('Cannot load order: tenantId is missing.');
      return;
    }
    const docRef = runInInjectionContext(this.environmentInjector, () =>
      doc(this.firestore, this.TENANT_COLLECTION, tenantId, this.ORDERS_COLLECTION, orderId)
    );
    try {
      const docSnap = await runInInjectionContext(this.environmentInjector, () =>
        getDoc(docRef)
      );
      if (docSnap.exists()) {
        const loadedOrder = docSnap.data() as ServiceOrder;
        this.setCurrentOrder({ ...loadedOrder, id: docSnap.id });
        return true;
      } else {
        console.log('No such order document!');
        return false;
      }
    } catch (error) {
      console.error('Error loading order:', error);
      return false;
    }
  }

  private async loadNextOrdersPage(tenantId: string): Promise<ServiceOrder[]> {
    const hasMore = this.ordersHasMoreByTenant.get(tenantId) ?? true;
    if (!hasMore) {
      return [];
    }
    const ordersCollectionRef = runInInjectionContext(this.environmentInjector, () =>
      collection(this.firestore, this.TENANT_COLLECTION, tenantId, this.ORDERS_COLLECTION)
    );
    const lastDoc = this.ordersLastDocByTenant.get(tenantId) ?? null;
    const constraints: Array<ReturnType<typeof orderBy> | ReturnType<typeof limit> | ReturnType<typeof startAfter>> = [
      orderBy('__name__'),
      limit(this.PAGE_SIZE)
    ];
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }
    const q = query(ordersCollectionRef, ...constraints);
    const snapshot = await runInInjectionContext(this.environmentInjector, () =>
      getDocs(q)
    );
    const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : lastDoc;
    this.ordersLastDocByTenant.set(tenantId, newLastDoc ?? null);
    this.ordersHasMoreByTenant.set(tenantId, snapshot.docs.length === this.PAGE_SIZE);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as ServiceOrder) }));
  }
}
