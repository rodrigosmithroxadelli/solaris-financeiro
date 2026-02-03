import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, addDoc, query, doc, updateDoc, where, getDocs, getDoc, limit, startAfter, orderBy } from '@angular/fire/firestore';
import { Observable, of, firstValueFrom, shareReplay, BehaviorSubject, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators'; // Import map and switchMap operators
import { Client } from '../models/client.model';
import { AuthService } from './auth.service';
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private environmentInjector = inject(EnvironmentInjector);

  private readonly CLIENTS_COLLECTION = 'clients'; // Top-level collection for clients
  private readonly PAGE_SIZE = 20;
  private clientsCache$?: Observable<Client[]>;
  private clientsSubject = new BehaviorSubject<Client[]>([]);
  private clientsLastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
  private clientsHasMore = true;
  private clientsLoading = false;
  private searchLastDocByTerm = new Map<string, QueryDocumentSnapshot<DocumentData> | null>();
  private searchHasMoreByTerm = new Map<string, boolean>();
  private clientByIdCache = new Map<string, Observable<Client>>();

  /**
   * Retrieves all clients for the current tenant in real-time.
   */
  getClients(): Observable<Client[]> {
    if (this.clientsCache$) {
      void this.loadNextClientsPage();
      return this.clientsCache$;
    }
    this.clientsCache$ = this.clientsSubject.asObservable().pipe(
      shareReplay({ bufferSize: 1, refCount: false })
    );
    void this.loadNextClientsPage();
    return this.clientsCache$;
  }

  /**
   * Retrieves a specific client by ID for the current tenant.
   */
  getClientById(id: string): Observable<Client> {
    const cached = this.clientByIdCache.get(id);
    if (cached) {
      return cached;
    }
    const client$ = this.authService.currentUser$.pipe(
      switchMap(user => {
        if (!user || !user.tenantId) {
          console.error('ClientService: Cannot get client by ID, user or tenantId is missing.');
          return of({} as Client); // Return empty client if not authenticated or no tenantId
        }
        return from(this.getClientByIdOnce(user.tenantId, id));
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.clientByIdCache.set(id, client$);
    return client$;
  }

  /**
   * Saves a client to Firestore (creates new or updates existing).
   * Automatically adds tenantId if creating a new client.
   * @param client The client object to save.
   * @returns The ID of the saved client.
   */
  async saveClient(client: Client): Promise<string | undefined> {
    const currentUser = await firstValueFrom(this.authService.currentUser$);
    const tenantId = currentUser?.tenantId;
    if (!tenantId) {
      console.error('ClientService: Cannot save client, tenantId is missing.');
      throw new Error('Tenant ID is required to save a client.');
    }

    const clientsCollectionRef = runInInjectionContext(this.environmentInjector, () =>
      collection(this.firestore, this.CLIENTS_COLLECTION)
    );
    let clientId = client.id;

    const clientToSave: Client = { ...client, tenantId: tenantId }; // Ensure tenantId is set

    try {
      if (clientId) {
        // Update existing client
        const docRef = runInInjectionContext(this.environmentInjector, () =>
          doc(clientsCollectionRef, clientId)
        );
        await runInInjectionContext(this.environmentInjector, () =>
          updateDoc(docRef, clientToSave as Partial<Client>)
        );
        console.log('ClientService: Client updated successfully:', clientId);
      } else {
        // Create new client
        const newDocRef = await runInInjectionContext(this.environmentInjector, () =>
          addDoc(clientsCollectionRef, clientToSave as Client)
        );
        clientId = newDocRef.id;
        console.log('ClientService: New client created successfully with ID:', clientId);
      }
      this.clientsCache$ = undefined;
      this.clientsSubject.next([]);
      this.clientsLastDoc = null;
      this.clientsHasMore = true;
      this.clientsLoading = false;
      this.searchLastDocByTerm.clear();
      this.searchHasMoreByTerm.clear();
      this.clientByIdCache.clear();
      return clientId;
    } catch (error) {
      console.error('ClientService: Error saving client:', error);
      throw error;
    }
  }

  /**
   * Searches for clients by name or whatsapp for the current tenant.
   * @param searchTerm The term to search for.
   * @returns An Observable of an array of matching Clients.
   */
  searchClients(searchTerm: string): Observable<Client[]> {
    return this.authService.currentUser$.pipe(
      switchMap(user => {
        if (!user || !user.tenantId) {
          console.error('ClientService: Cannot search clients, user or tenantId is missing.');
          return of([]);
        }
        return from(this.searchClientsOnce(user.tenantId, searchTerm));
      })
    );
  }

  private async loadNextClientsPage(): Promise<void> {
    if (this.clientsLoading || !this.clientsHasMore) {
      return;
    }
    this.clientsLoading = true;
    const currentUser = await firstValueFrom(this.authService.currentUser$);
    if (!currentUser || !currentUser.tenantId) {
      console.error('ClientService: Cannot get clients, user or tenantId is missing.');
      this.clientsLoading = false;
      return;
    }
    const clientsCollectionRef = runInInjectionContext(this.environmentInjector, () =>
      collection(this.firestore, this.CLIENTS_COLLECTION)
    );
    const constraints: Array<ReturnType<typeof where> | ReturnType<typeof orderBy> | ReturnType<typeof limit> | ReturnType<typeof startAfter>> = [
      where('tenantId', '==', currentUser.tenantId),
      orderBy('__name__'),
      limit(this.PAGE_SIZE)
    ];
    if (this.clientsLastDoc) {
      constraints.push(startAfter(this.clientsLastDoc));
    }
    const q = query(clientsCollectionRef, ...constraints);
    const snapshot = await runInInjectionContext(this.environmentInjector, () =>
      getDocs(q)
    );
    const newClients = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as Client) }));
    this.clientsLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : this.clientsLastDoc;
    this.clientsHasMore = snapshot.docs.length === this.PAGE_SIZE;
    this.clientsSubject.next([...this.clientsSubject.value, ...newClients]);
    this.clientsLoading = false;
  }

  private async getClientByIdOnce(tenantId: string, id: string): Promise<Client> {
    const clientDocRef = runInInjectionContext(this.environmentInjector, () =>
      doc(this.firestore, this.CLIENTS_COLLECTION, id)
    );
    const clientDocSnap = await runInInjectionContext(this.environmentInjector, () =>
      getDoc(clientDocRef)
    );
    if (clientDocSnap.exists()) {
      const clientData = clientDocSnap.data() as Client;
      if (clientData.tenantId === tenantId) {
        return { id: clientDocSnap.id, ...clientData };
      }
    }
    return {} as Client;
  }

  private async searchClientsOnce(tenantId: string, searchTerm: string): Promise<Client[]> {
    const normalizedTerm = searchTerm.toLowerCase();
    const lastDoc = this.searchLastDocByTerm.get(normalizedTerm) ?? null;
    const hasMore = this.searchHasMoreByTerm.get(normalizedTerm) ?? true;
    if (!hasMore) {
      return [];
    }
    const clientsCollectionRef = runInInjectionContext(this.environmentInjector, () =>
      collection(this.firestore, this.CLIENTS_COLLECTION)
    );
    const constraints: Array<ReturnType<typeof where> | ReturnType<typeof orderBy> | ReturnType<typeof limit> | ReturnType<typeof startAfter>> = [
      where('tenantId', '==', tenantId),
      orderBy('__name__'),
      limit(this.PAGE_SIZE)
    ];
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }
    const q = query(clientsCollectionRef, ...constraints);
    const snapshot = await runInInjectionContext(this.environmentInjector, () =>
      getDocs(q)
    );
    const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : lastDoc;
    this.searchLastDocByTerm.set(normalizedTerm, newLastDoc ?? null);
    this.searchHasMoreByTerm.set(normalizedTerm, snapshot.docs.length === this.PAGE_SIZE);
    return snapshot.docs
      .map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as Client) }))
      .filter(client =>
        client.name.toLowerCase().includes(normalizedTerm) ||
        client.whatsapp.includes(normalizedTerm)
      );
  }
}
