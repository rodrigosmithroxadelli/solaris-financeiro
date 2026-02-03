import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { PaymentStatus } from '../models/service-order.model';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private firestore = inject(Firestore);
  private environmentInjector = inject(EnvironmentInjector);

  async updateTransactionPaymentStatus(transactionId: string, status: PaymentStatus) {
    const docRef = runInInjectionContext(this.environmentInjector, () =>
      doc(this.firestore, 'lancamentos', transactionId)
    );
    await runInInjectionContext(this.environmentInjector, () =>
      updateDoc(docRef, { paymentStatus: status })
    );
  }

  async deleteTransaction(transactionId: string) {
    const docRef = runInInjectionContext(this.environmentInjector, () =>
      doc(this.firestore, 'lancamentos', transactionId)
    );
    await runInInjectionContext(this.environmentInjector, () =>
      deleteDoc(docRef)
    );
  }
}
