import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, collectionData, query, orderBy, Timestamp } from '@angular/fire/firestore';
import { Observable, shareReplay, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';

export type FinancialType = 'entrada' | 'saida';
export type PaymentMethod = 'pix' | 'credito' | 'debito' | 'dinheiro' | 'boleto' | 'transferencia';
export type PaymentStatus = 'PENDENTE' | 'PAGO';

export interface FinancialRecord {
  id?: string;
  valor: number;
  data: Timestamp;
  tipo: FinancialType;
  metodoPagamento: PaymentMethod;
  statusPagamento?: PaymentStatus;
}

@Injectable({
  providedIn: 'root'
})
export class FinancialService {
  private firestore = inject(Firestore);
  private environmentInjector = inject(EnvironmentInjector);
  private authService = inject(AuthService);
  private readonly COLLECTION = 'lancamentos';
  private collectionByTenant = new Map<string, ReturnType<typeof collection>>();

  private getCollectionRef(tenantId: string) {
    const cached = this.collectionByTenant.get(tenantId);
    if (cached) {
      return cached;
    }
    const ref = runInInjectionContext(this.environmentInjector, () =>
      collection(this.firestore, 'empresas', tenantId, this.COLLECTION)
    );
    this.collectionByTenant.set(tenantId, ref);
    return ref;
  }

  private records$ = this.authService.currentUser$.pipe(
    switchMap(user => {
      if (!user?.tenantId) {
        console.error('FinancialService: usuário ou tenantId ausente.');
        return of([] as FinancialRecord[]);
      }
      const collectionRef = this.getCollectionRef(user.tenantId);
      const q = query(collectionRef, orderBy('date', 'desc'));
      return runInInjectionContext(this.environmentInjector, () =>
        collectionData(q, { idField: 'id' })
      ).pipe(
        map(records => (records as Array<{
          id?: string;
          amount?: number;
          date?: string;
          type?: 'entrada' | 'saida';
          paymentMethod?: string;
          paymentStatus?: PaymentStatus;
        }>).map(record => ({
          id: record.id,
          valor: record.amount ?? 0,
          data: record.date ? Timestamp.fromDate(new Date(record.date)) : Timestamp.fromDate(new Date(0)),
          tipo: record.type === 'saida' ? 'saida' : 'entrada',
          metodoPagamento: this.mapPaymentMethod(record.paymentMethod),
          statusPagamento: record.paymentStatus
        })))
      );
    })
  ) as Observable<FinancialRecord[]>;

  private sharedRecords$ = this.records$.pipe(shareReplay({ bufferSize: 1, refCount: true }));

  getRegistros(): Observable<FinancialRecord[]> {
    return this.sharedRecords$;
  }

  getEntradas(period: 'dia' | 'mes', date: Date = new Date()): Observable<FinancialRecord[]> {
    return this.getByTipo('entrada', period, date);
  }

  getSaidas(period: 'dia' | 'mes', date: Date = new Date()): Observable<FinancialRecord[]> {
    return this.getByTipo('saida', period, date);
  }

  getVendas(period: 'dia' | 'mes', date: Date = new Date()): Observable<FinancialRecord[]> {
    return this.getByTipo('entrada', period, date);
  }

  getMovimentacoes(period: 'dia' | 'mes', date: Date = new Date()): Observable<FinancialRecord[]> {
    return this.sharedRecords$.pipe(
      map(records => this.filterByPeriod(records, period, date))
    );
  }

  private getByTipo(tipo: FinancialType, period: 'dia' | 'mes', date: Date): Observable<FinancialRecord[]> {
    return this.getMovimentacoes(period, date).pipe(
      map(records => records.filter(record => record.tipo === tipo))
    );
  }

  private filterByPeriod(records: FinancialRecord[], period: 'dia' | 'mes', date: Date): FinancialRecord[] {
    const { start, end } = this.getDateRange(period, date);
    return records.filter(record => {
      if (record.statusPagamento === 'PENDENTE') {
        return false;
      }
      const recordDate = record.data.toDate();
      return recordDate >= start && recordDate <= end;
    });
  }

  private getDateRange(period: 'dia' | 'mes', date: Date): { start: Date; end: Date } {
    const target = new Date(date);
    if (period === 'dia') {
      const start = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0, 0);
      const end = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 23, 59, 59, 999);
      return { start, end };
    }
    const start = new Date(target.getFullYear(), target.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  private mapPaymentMethod(method?: string): PaymentMethod {
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
