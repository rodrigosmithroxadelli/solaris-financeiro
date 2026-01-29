// src/app/services/firebase.service.ts

import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, addDoc, updateDoc, query, where, Timestamp, collectionData } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ServiceOrder, Payment } from '../models/service-order.model'; // Assuming these are in service-order.model.ts
import { CatalogItem } from '../models/catalog.model'; // Import CatalogItem

/**
 * Represents a simplified transaction record for cash flow.
 */
export interface TransactionRecord {
  id?: string; // Optional Firestore document ID
  tenantId: string;
  serviceOrderId: string; // Link to the ServiceOrder
  type: 'entrada' | 'saida'; // In this context, payments are 'entrada'
  method: Payment['method'];
  grossValue: number;
  netValue: number;
  date: Timestamp; // Date of transaction (e.g., payment date or order finished date)
  description: string; // e.g., "Pagamento OS #1001 - PIX"
  categoryId?: string; // Optional: could link to a finance category
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private readonly TENANTS_COLLECTION = 'tenants';
  private readonly SERVICE_ORDERS_COLLECTION = 'serviceOrders';
  private readonly TRANSACTIONS_COLLECTION = 'transactions'; // For cash flow records
  private readonly CATALOG_COLLECTION = 'catalogItems'; // For service/product catalog

  private firestore = inject(Firestore);
  private authService = inject(AuthService); // Assuming AuthService provides tenantId

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
   * If the order status is 'PAID', it also creates transaction records for cash flow.
   * @param order The ServiceOrder object to save.
   * @returns The ID of the saved or updated order.
   */
  async saveOrder(order: ServiceOrder): Promise<string | undefined> {
    if (!order.tenantId) {
      console.error('FirebaseService: Cannot save order, tenantId is missing.');
      throw new Error('Tenant ID is required to save an order.');
    }

    const ordersCollectionRef = collection(this.firestore, this.TENANTS_COLLECTION, order.tenantId, this.SERVICE_ORDERS_COLLECTION);
    let orderId = order.id;

    // Ensure all Date objects are converted to Firestore Timestamps before saving
    const orderToSave = this.convertDatesToTimestamps(order);

    try {
      if (orderId) {
        // Update existing order
        const docRef = doc(ordersCollectionRef, orderId);
        await updateDoc(docRef, orderToSave as Partial<ServiceOrder>);
        console.log('FirebaseService: Order updated successfully:', orderId);
      } else {
        // Create new order
        const newDocRef = await addDoc(ordersCollectionRef, orderToSave as ServiceOrder);
        orderId = newDocRef.id;
        console.log('FirebaseService: New order created successfully with ID:', orderId);
      }

      // Rule: If status is 'PAID', create transaction records for cash flow
      if (order.status === 'PAID' && orderId) {
        await this.createTransactionRecords(orderToSave, orderId);
      }

      return orderId;
    } catch (error) {
      console.error('FirebaseService: Error saving order:', error);
      throw error;
    }
  }

  /**
   * Creates transaction records in the 'transactions' collection for each payment in a PAID ServiceOrder.
   * @param serviceOrder The PAID ServiceOrder.
   * @param serviceOrderId The ID of the saved ServiceOrder.
   */
  private async createTransactionRecords(serviceOrder: ServiceOrder, serviceOrderId: string): Promise<void> {
    if (!serviceOrder.financial || !serviceOrder.financial.payments || serviceOrder.financial.payments.length === 0) {
      console.warn(`FirebaseService: No payments to record for ServiceOrder ID: ${serviceOrderId}`);
      return;
    }

    const transactionsCollectionRef = collection(this.firestore, this.TENANTS_COLLECTION, serviceOrder.tenantId, this.TRANSACTIONS_COLLECTION);

    for (const payment of serviceOrder.financial.payments) {
      const transactionRecord: TransactionRecord = {
        tenantId: serviceOrder.tenantId,
        serviceOrderId: serviceOrderId,
        type: 'entrada', // Payments are considered 'entrada' (incoming) for cash flow
        method: payment.method,
        grossValue: payment.grossValue,
        netValue: payment.netValue,
        date: payment.dueDate instanceof Timestamp ? payment.dueDate : Timestamp.fromDate(payment.dueDate as Date), // Ensure Timestamp
        description: `Pagamento OS #${serviceOrder.number} - ${payment.method} (${serviceOrder.clientName})`
        // categoryId could be added here if a system-wide category for sales/services exists
      };

      try {
        await addDoc(transactionsCollectionRef, transactionRecord);
        console.log(`FirebaseService: Transaction record created for payment in OS ${serviceOrderId}`);
      } catch (error) {
        console.error(`FirebaseService: Error creating transaction record for payment in OS ${serviceOrderId}:`, error);
        throw error;
      }
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

    const catalogCollectionRef = collection(this.firestore, this.TENANTS_COLLECTION, item.tenantId, this.CATALOG_COLLECTION);
    let itemId = item.id;

    try {
      if (itemId) {
        // Update existing item
        const docRef = doc(catalogCollectionRef, itemId);
        await updateDoc(docRef, item as Partial<CatalogItem>);
        console.log('FirebaseService: Catalog item updated successfully:', itemId);
      } else {
        // Create new item
        const newDocRef = await addDoc(catalogCollectionRef, item as CatalogItem);
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
        const catalogCollectionRef = collection(this.firestore, this.TENANTS_COLLECTION, user.tenantId, this.CATALOG_COLLECTION);
        const q = query(catalogCollectionRef, where('tenantId', '==', user.tenantId));
        return collectionData(q, { idField: 'id' }) as Observable<CatalogItem[]>;
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
        const ordersCollectionRef = collection(this.firestore, this.TENANTS_COLLECTION, user.tenantId, this.SERVICE_ORDERS_COLLECTION);
        const q = query(ordersCollectionRef, where('tenantId', '==', user.tenantId));
        return collectionData(q, { idField: 'id' }).pipe(
          map(orders => orders as ServiceOrder[])
        );
      })
    );
  }

}
