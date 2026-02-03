import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, updateDoc, deleteDoc, getDocs, query, where } from '@angular/fire/firestore';
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

  async updateTransactionPaymentStatusByServiceOrderId(serviceOrderId: string, status: PaymentStatus) {
    const collectionRef = runInInjectionContext(this.environmentInjector, () =>
      collection(this.firestore, 'lancamentos')
    );
    const q = runInInjectionContext(this.environmentInjector, () =>
      query(collectionRef, where('serviceOrderId', '==', serviceOrderId))
    );
    const snapshot = await runInInjectionContext(this.environmentInjector, () => getDocs(q));
    if (snapshot.empty) {
      return false;
    }
    for (const docSnap of snapshot.docs) {
      const docRef = runInInjectionContext(this.environmentInjector, () =>
        doc(this.firestore, 'lancamentos', docSnap.id)
      );
      await runInInjectionContext(this.environmentInjector, () =>
        updateDoc(docRef, { paymentStatus: status })
      );
    }
    return true;
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
