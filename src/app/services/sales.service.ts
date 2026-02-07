import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, addDoc, doc, updateDoc, Timestamp } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { filter, switchMap, take } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { Transaction } from '../models/transaction.model';
import { ServiceOrder, PaymentStatus, ServicePaymentMethod } from '../models/service-order.model';
import { User } from '../models/user.model';

export interface ServiceSaleInput {
  title: string;
  amount: number;
  category: string;
  paymentMethod: Transaction['paymentMethod'];
  date: string;
  clientName?: string;
  clientPhone?: string;
  clientAddress?: string;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SalesService {
  private firestore = inject(Firestore);
  private environmentInjector = inject(EnvironmentInjector);
  private authService = inject(AuthService);

  createServiceSale(input: ServiceSaleInput): Observable<{ transactionId: string; orderId: string }> {
    return this.authService.currentUser$.pipe(
      filter((user): user is User => !!user?.tenantId),
      take(1),
      switchMap(user => this.createRecords(user.tenantId!, input))
    );
  }

  private createRecords(tenantId: string, input: ServiceSaleInput): Observable<{ transactionId: string; orderId: string }> {
    const paymentStatus: PaymentStatus = 'PENDENTE';
    const now = Timestamp.now();

    return new Observable(observer => {
      (async () => {
        try {
          const ordersCollection = runInInjectionContext(this.environmentInjector, () =>
            collection(this.firestore, 'empresas', tenantId, 'serviceOrders')
          );
          const transactionsCollection = runInInjectionContext(this.environmentInjector, () =>
            collection(this.firestore, 'empresas', tenantId, 'lancamentos')
          );

          const orderPayload: Partial<ServiceOrder> = {
            tenantId,
            number: 0,
            clientId: '',
            clientName: input.clientName || '',
            vehicle: { plate: '', brand: '', model: '', color: '' },
            status: 'OPEN',
            paymentStatus,
            paymentMethod: this.mapPaymentMethod(input.paymentMethod),
            serviceValue: input.amount,
            checklist: { fuelLevel: 0, notes: '', photosUrls: [] },
            items: [],
            financial: {
              subtotal: input.amount,
              globalDiscount: 0,
              totalPrice: input.amount,
              payments: [],
              balanceDue: input.amount
            },
            timestamps: { created: now }
          };

          const orderRef = await runInInjectionContext(this.environmentInjector, () =>
            addDoc(ordersCollection, orderPayload as ServiceOrder)
          );

          const transactionPayload: Transaction = {
            type: 'entrada',
            title: input.title,
            amount: input.amount,
            category: input.category,
            paymentMethod: input.paymentMethod,
            paymentStatus,
            serviceOrderId: orderRef.id,
            date: input.date,
            description: input.description,
            clientName: input.clientName,
            clientPhone: input.clientPhone,
            clientAddress: input.clientAddress
          };

          const transactionRef = await runInInjectionContext(this.environmentInjector, () =>
            addDoc(transactionsCollection, transactionPayload)
          );

          await runInInjectionContext(this.environmentInjector, () =>
            updateDoc(doc(this.firestore, 'empresas', tenantId, 'serviceOrders', orderRef.id), { linkedTransactionId: transactionRef.id })
          );

          observer.next({ transactionId: transactionRef.id, orderId: orderRef.id });
          observer.complete();
        } catch (error) {
          observer.error(error);
        }
      })();
    });
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
