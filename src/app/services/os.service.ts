import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, doc, writeBatch } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import { Lancamento, Os } from '../models/interfaces';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class OsService {
  private firestore = inject(Firestore);
  private environmentInjector = inject(EnvironmentInjector);
  private authService = inject(AuthService);

  async criarOsComFinanceiro(os: Os, parcelas: Lancamento[]): Promise<void> {
    const currentUser = await firstValueFrom(this.authService.currentUser$);
    const empresaId = currentUser?.tenantId;
    if (!empresaId) {
      console.error('OsService: Cannot create OS, tenantId is missing.');
      throw new Error('Tenant ID is required to create OS.');
    }
    const batch = runInInjectionContext(this.environmentInjector, () => writeBatch(this.firestore));
    const osId = os.id ?? `os_${Date.now()}`;
    const osRef = runInInjectionContext(this.environmentInjector, () =>
      doc(this.firestore, 'empresas', empresaId, 'os', osId)
    );
    batch.set(osRef, { ...os, id: osId, empresaId });

    parcelas.forEach((parcela, indice) => {
      const lancamentoId = `${osId}_${indice + 1}`;
      const dataCompetencia = parcela.dataCompetencia ?? parcela.data_vencimento ?? new Date();
      const lancamentoRef = runInInjectionContext(this.environmentInjector, () =>
        doc(this.firestore, 'empresas', empresaId, 'lancamentosFinanceiros', lancamentoId)
      );
      const payload: Lancamento = {
        ...parcela,
        id: lancamentoId,
        id_os: osId,
        empresaId,
        dataCompetencia,
        status: parcela.status ?? 'PENDENTE'
      };
      batch.set(lancamentoRef, payload);
    });

    await runInInjectionContext(this.environmentInjector, () => batch.commit());
  }
}
