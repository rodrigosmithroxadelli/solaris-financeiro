import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, updateDoc, deleteDoc, getDocs, query, where } from '@angular/fire/firestore';
import { PaymentStatus } from '../models/service-order.model';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private firestore = inject(Firestore);
  private environmentInjector = inject(EnvironmentInjector);
  private authService = inject(AuthService);

  private async getTenantId(): Promise<string> {
    const user = await firstValueFrom(this.authService.currentUser$);
    if (!user?.tenantId) {
      throw new Error('Tenant ID é obrigatório.');
    }
    return user.tenantId;
  }

  async updateTransactionPaymentStatus(transactionId: string, status: PaymentStatus) {
    const tenantId = await this.getTenantId();
    const docRef = runInInjectionContext(this.environmentInjector, () =>
      doc(this.firestore, 'empresas', tenantId, 'lancamentos', transactionId)
    );
    await runInInjectionContext(this.environmentInjector, () =>
      updateDoc(docRef, { paymentStatus: status })
    );
  }

  async updateTransactionPaymentStatusByServiceOrderId(serviceOrderId: string, status: PaymentStatus) {
    const tenantId = await this.getTenantId();
    const collectionRef = runInInjectionContext(this.environmentInjector, () =>
      collection(this.firestore, 'empresas', tenantId, 'lancamentos')
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
        doc(this.firestore, 'empresas', tenantId, 'lancamentos', docSnap.id)
      );
      await runInInjectionContext(this.environmentInjector, () =>
        updateDoc(docRef, { paymentStatus: status })
      );
    }
    return true;
  }

  async deleteTransaction(transactionId: string) {
    const tenantId = await this.getTenantId();
    const docRef = runInInjectionContext(this.environmentInjector, () =>
      doc(this.firestore, 'empresas', tenantId, 'lancamentos', transactionId)
    );
    await runInInjectionContext(this.environmentInjector, () =>
      deleteDoc(docRef)
    );
  }
}
