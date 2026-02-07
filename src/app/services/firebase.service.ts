// src/app/services/firebase.service.ts

import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, addDoc, updateDoc, query, where, Timestamp, getDocs, limit, startAfter, orderBy } from '@angular/fire/firestore';
import { Observable, of, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ServiceOrder, Payment } from '../models/service-order.model'; // Assuming these are in service-order.model.ts
import { CatalogItem } from '../models/catalog.model'; // Import CatalogItem
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private readonly TENANTS_COLLECTION = 'empresas';
  private readonly SERVICE_ORDERS_COLLECTION = 'serviceOrders';
  private readonly CATALOG_COLLECTION = 'catalogItems'; // For service/product catalog
  private readonly PAGE_SIZE = 20;

  private firestore = inject(Firestore);
  private authService = inject(AuthService); // Assuming AuthService provides tenantId
  private environmentInjector = inject(EnvironmentInjector);
  private catalogLastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
  private catalogHasMore = true;
  private ordersLastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
  private ordersHasMore = true;

  constructor() {}

  /**
   * Converts JavaScript Date objects within a ServiceOrder to Firestore Timestamps.
   * This is crucial for proper storage and querying in Firestore.
   * @param order The ServiceOrder to convert.
   * @returns A new ServiceOrder object with Dates converted to Timestamps.
   */
  private convertDatesToTimestamps(order: ServiceOrder): ServiceOrder {
    const convertedOrder = { ...order };

    // Convert timestamps
    if (convertedOrder.timestamps) {
      if (convertedOrder.timestamps.created instanceof Date) {
        convertedOrder.timestamps.created = Timestamp.fromDate(convertedOrder.timestamps.created);
      }
      if (convertedOrder.timestamps.scheduled instanceof Date) {
        convertedOrder.timestamps.scheduled = Timestamp.fromDate(convertedOrder.timestamps.scheduled);
      }
      if (convertedOrder.timestamps.finished instanceof Date) {
        convertedOrder.timestamps.finished = Timestamp.fromDate(convertedOrder.timestamps.finished);
      }
    }

    // Convert checklist.completedAt
    if (convertedOrder.checklist && convertedOrder.checklist.completedAt instanceof Date) {
      convertedOrder.checklist.completedAt = Timestamp.fromDate(convertedOrder.checklist.completedAt);
    }

    // Convert payment dueDates
    if (convertedOrder.financial && convertedOrder.financial.payments && convertedOrder.financial.payments.length > 0) {
      convertedOrder.financial.payments = convertedOrder.financial.payments.map(payment => {
        if (payment.dueDate instanceof Date) {
          return { ...payment, dueDate: Timestamp.fromDate(payment.dueDate) };
        }
        return payment;
      });
    }

    return convertedOrder;
  }

  /**
   * Saves a ServiceOrder to Firestore.
   * If the order has an ID, it updates the existing document. Otherwise, it creates a new one.
   * @param order The ServiceOrder object to save.
   * @returns The ID of the saved or updated order.
   */
  async saveOrder(order: ServiceOrder): Promise<string | undefined> {
    if (!order.tenantId) {
      console.error('FirebaseService: Cannot save order, tenantId is missing.');
      throw new Error('Tenant ID is required to save an order.');
    }

    const ordersCollectionRef = runInInjectionContext(this.environmentInjector, () =>
      collection(this.firestore, this.TENANTS_COLLECTION, order.tenantId, this.SERVICE_ORDERS_COLLECTION)
    );
    let orderId = order.id;

    // Ensure all Date objects are converted to Firestore Timestamps before saving
    const orderToSave = this.convertDatesToTimestamps(order);

    try {
      if (orderId) {
        // Update existing order
        const docRef = runInInjectionContext(this.environmentInjector, () =>
          doc(ordersCollectionRef, orderId)
        );
        await runInInjectionContext(this.environmentInjector, () =>
          updateDoc(docRef, orderToSave as Partial<ServiceOrder>)
        );
        console.log('FirebaseService: Order updated successfully:', orderId);
      } else {
        // Create new order
        const newDocRef = await runInInjectionContext(this.environmentInjector, () =>
          addDoc(ordersCollectionRef, orderToSave as ServiceOrder)
        );
        orderId = newDocRef.id;
        console.log('FirebaseService: New order created successfully with ID:', orderId);
      }

      return orderId;
    } catch (error) {
      console.error('FirebaseService: Error saving order:', error);
      throw error;
    }
  }

  /**
   * Saves a CatalogItem (Service or Product) to Firestore.
   * If the item has an ID, it updates the existing document. Otherwise, it creates a new one.
   * @param item The CatalogItem object to save.
   * @returns The ID of the saved or updated item.
   */
  async saveCatalogItem(item: CatalogItem): Promise<string | undefined> {
    if (!item.tenantId) {
      console.error('FirebaseService: Cannot save catalog item, tenantId is missing.');
      throw new Error('Tenant ID is required to save a catalog item.');
    }

    const catalogCollectionRef = runInInjectionContext(this.environmentInjector, () =>
      collection(this.firestore, this.TENANTS_COLLECTION, item.tenantId, this.CATALOG_COLLECTION)
    );
    let itemId = item.id;

    try {
      if (itemId) {
        // Update existing item
        const docRef = runInInjectionContext(this.environmentInjector, () =>
          doc(catalogCollectionRef, itemId)
        );
        await runInInjectionContext(this.environmentInjector, () =>
          updateDoc(docRef, item as Partial<CatalogItem>)
        );
        console.log('FirebaseService: Catalog item updated successfully:', itemId);
      } else {
        // Create new item
        const newDocRef = await runInInjectionContext(this.environmentInjector, () =>
          addDoc(catalogCollectionRef, item as CatalogItem)
        );
        itemId = newDocRef.id;
        console.log('FirebaseService: New catalog item created successfully with ID:', itemId);
      }
      return itemId;
    } catch (error) {
      console.error('FirebaseService: Error saving catalog item:', error);
      throw error;
    }
  }

  /**
   * Retrieves all catalog items for a given tenant in real-time.
   * @param tenantId The ID of the tenant.
   * @returns An Observable of an array of CatalogItem.
   */
  getCatalogItems(): Observable<CatalogItem[]> {
    return this.authService.currentUser$.pipe(
      switchMap(user => {
        if (!user || !user.tenantId) {
          console.error('FirebaseService: Cannot get catalog items, user or tenantId is missing.');
          return of([]); // Return empty observable if no user or tenantId
        }
        return from(this.getCatalogItemsPage(user.tenantId));
      })
    );
  }

  /**
   * Retrieves service orders for a given tenant in real-time.
   * @param tenantId The ID of the tenant.
   * @returns An Observable of an array of ServiceOrder.
   */
  getServiceOrders(): Observable<ServiceOrder[]> {
    return this.authService.currentUser$.pipe(
      switchMap(user => {
        if (!user || !user.tenantId) {
          console.error('FirebaseService: Cannot fetch orders, user or tenantId is missing.');
          return of([]); // Return empty observable if no user or tenantId
        }
        return from(this.getServiceOrdersPage(user.tenantId));
      })
    );
  }

  private async getCatalogItemsPage(tenantId: string): Promise<CatalogItem[]> {
    if (!this.catalogHasMore) {
      return [];
    }
    const catalogCollectionRef = runInInjectionContext(this.environmentInjector, () =>
      collection(this.firestore, this.TENANTS_COLLECTION, tenantId, this.CATALOG_COLLECTION)
    );
    const constraints: Array<ReturnType<typeof where> | ReturnType<typeof orderBy> | ReturnType<typeof limit> | ReturnType<typeof startAfter>> = [
      where('tenantId', '==', tenantId),
      orderBy('__name__'),
      limit(this.PAGE_SIZE)
    ];
    if (this.catalogLastDoc) {
      constraints.push(startAfter(this.catalogLastDoc));
    }
    const q = query(catalogCollectionRef, ...constraints);
    const snapshot = await runInInjectionContext(this.environmentInjector, () =>
      getDocs(q)
    );
    this.catalogLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : this.catalogLastDoc;
    this.catalogHasMore = snapshot.docs.length === this.PAGE_SIZE;
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as CatalogItem) }));
  }

  private async getServiceOrdersPage(tenantId: string): Promise<ServiceOrder[]> {
    if (!this.ordersHasMore) {
      return [];
    }
    const ordersCollectionRef = runInInjectionContext(this.environmentInjector, () =>
      collection(this.firestore, this.TENANTS_COLLECTION, tenantId, this.SERVICE_ORDERS_COLLECTION)
    );
    const constraints: Array<ReturnType<typeof where> | ReturnType<typeof orderBy> | ReturnType<typeof limit> | ReturnType<typeof startAfter>> = [
      where('tenantId', '==', tenantId),
      orderBy('__name__'),
      limit(this.PAGE_SIZE)
    ];
    if (this.ordersLastDoc) {
      constraints.push(startAfter(this.ordersLastDoc));
    }
    const q = query(ordersCollectionRef, ...constraints);
    const snapshot = await runInInjectionContext(this.environmentInjector, () =>
      getDocs(q)
    );
    this.ordersLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : this.ordersLastDoc;
    this.ordersHasMore = snapshot.docs.length === this.PAGE_SIZE;
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as ServiceOrder) }));
  }

}
