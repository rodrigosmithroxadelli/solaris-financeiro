import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, collectionData, query, doc, docData, setDoc, updateDoc, where } from '@angular/fire/firestore';
import { Observable, of, firstValueFrom } from 'rxjs';
import { map, switchMap } from 'rxjs/operators'; // Import map and switchMap operators
import { Client } from '../models/client.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  private readonly CLIENTS_COLLECTION = 'clients'; // Top-level collection for clients

  /**
   * Retrieves all clients for the current tenant in real-time.
   */
  getClients(): Observable<Client[]> {
    return this.authService.currentUser$.pipe(
      switchMap(user => {
        if (!user || !user.tenantId) {
          console.error('ClientService: Cannot get clients, user or tenantId is missing.');
          return of([]);
        }
        const clientsCollectionRef = collection(this.firestore, this.CLIENTS_COLLECTION);
        const q = query(clientsCollectionRef, where('tenantId', '==', user.tenantId));
        return collectionData(q, { idField: 'id' }) as Observable<Client[]>;
      })
    );
  }

  /**
   * Retrieves a specific client by ID for the current tenant.
   */
  getClientById(id: string): Observable<Client> {
    return this.authService.currentUser$.pipe(
      switchMap(user => {
        if (!user || !user.tenantId) {
          console.error('ClientService: Cannot get client by ID, user or tenantId is missing.');
          return of({} as Client); // Return empty client if not authenticated or no tenantId
        }
        const clientDocRef = doc(this.firestore, this.CLIENTS_COLLECTION, id);
        return docData(clientDocRef, { idField: 'id' }).pipe(
          map(client => {
            if (client && (client as Client).tenantId === user.tenantId) {
              return client as Client;
            }
            return {} as Client; // Return empty if not found or not belonging to tenant
          })
        );
      })
    );
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

    const clientsCollectionRef = collection(this.firestore, this.CLIENTS_COLLECTION);
    let clientId = client.id;

    const clientToSave: Client = { ...client, tenantId: tenantId }; // Ensure tenantId is set

    try {
      if (clientId) {
        // Update existing client
        const docRef = doc(clientsCollectionRef, clientId);
        await updateDoc(docRef, clientToSave as Partial<Client>);
        console.log('ClientService: Client updated successfully:', clientId);
      } else {
        // Create new client
        const newDocRef = await addDoc(clientsCollectionRef, clientToSave as Client);
        clientId = newDocRef.id;
        console.log('ClientService: New client created successfully with ID:', clientId);
      }
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

        const clientsCollectionRef = collection(this.firestore, this.CLIENTS_COLLECTION);
        const q = query(clientsCollectionRef, where('tenantId', '==', user.tenantId));

        // Client-side filtering after fetching
        return collectionData(q, { idField: 'id' }).pipe(
          map(clients => {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            return (clients as Client[]).filter(client =>
              client.name.toLowerCase().includes(lowerCaseSearchTerm) ||
              client.whatsapp.includes(lowerCaseSearchTerm)
            );
          })
        );
      })
    );
  }
}