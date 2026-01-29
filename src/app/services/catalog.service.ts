import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, collectionData, query, doc, docData, setDoc, updateDoc, where, deleteDoc } from '@angular/fire/firestore';
import { Observable, of, firstValueFrom } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { CatalogItem } from '../models/catalog.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class CatalogService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  private readonly CATALOG_COLLECTION = 'catalogItems'; // Top-level collection for catalog items

  /**
   * Retrieves all catalog items for the current tenant in real-time.
   */
  getCatalogItems(): Observable<CatalogItem[]> {
    return this.authService.currentUser$.pipe(
      switchMap(user => {
        console.log('CatalogService.getCatalogItems() - user:', user);
        if (!user || !user.tenantId) {
          console.error('CatalogService: Cannot get items, user or tenantId is missing.');
          return of([]);
        }
        console.log('CatalogService: Loading items for tenantId:', user.tenantId);
        const catalogCollectionRef = collection(this.firestore, this.CATALOG_COLLECTION);
        const q = query(catalogCollectionRef, where('tenantId', '==', user.tenantId));
        return collectionData(q, { idField: 'id' }) as Observable<CatalogItem[]>;
      })
    );
  }

  /**
   * Retrieves a specific catalog item by ID for the current tenant.
   */
  getCatalogItemById(id: string): Observable<CatalogItem> {
    return this.authService.currentUser$.pipe(
      switchMap(user => {
        if (!user || !user.tenantId) {
          console.error('CatalogService: Cannot get item by ID, user or tenantId is missing.');
          return of({} as CatalogItem);
        }
        const itemDocRef = doc(this.firestore, this.CATALOG_COLLECTION, id);
        return docData(itemDocRef, { idField: 'id' }).pipe(
          map(item => {
            if (item && (item as CatalogItem).tenantId === user.tenantId) {
              return item as CatalogItem;
            }
            return {} as CatalogItem;
          })
        );
      })
    );
  }

  /**
   * Saves a catalog item to Firestore (creates new or updates existing).
   * Automatically adds tenantId if creating a new item.
   * @param item The catalog item object to save.
   * @returns The ID of the saved item.
   */
  async saveCatalogItem(item: CatalogItem): Promise<string | undefined> {
    const currentUser = await firstValueFrom(this.authService.currentUser$);
    const tenantId = currentUser?.tenantId;
    if (!tenantId) {
      console.error('CatalogService: Cannot save item, tenantId is missing.');
      throw new Error('Tenant ID is required to save a catalog item.');
    }

    const catalogCollectionRef = collection(this.firestore, this.CATALOG_COLLECTION);
    let itemId = item.id;

    const itemToSave: CatalogItem = { ...item, tenantId: tenantId };

    try {
      if (itemId) {
        // Update existing item
        const docRef = doc(catalogCollectionRef, itemId);
        await updateDoc(docRef, itemToSave as Partial<CatalogItem>);
        console.log('CatalogService: Item updated successfully:', itemId);
      } else {
        // Create new item
        const newDocRef = await addDoc(catalogCollectionRef, itemToSave as CatalogItem);
        itemId = newDocRef.id;
        console.log('CatalogService: New item created successfully with ID:', itemId);
      }
      return itemId;
    } catch (error) {
      console.error('CatalogService: Error saving item:', error);
      throw error;
    }
  }

  /**
   * Deletes a catalog item from Firestore.
   * @param id The ID of the item to delete.
   */
  async deleteCatalogItem(id: string): Promise<void> {
    const currentUser = await firstValueFrom(this.authService.currentUser$);
    if (!currentUser || !currentUser.tenantId) {
      console.error('CatalogService: Cannot delete item, tenantId is missing.');
      throw new Error('Tenant ID is required to delete a catalog item.');
    }

    try {
      const itemDocRef = doc(this.firestore, this.CATALOG_COLLECTION, id);
      await deleteDoc(itemDocRef);
      console.log('CatalogService: Item deleted successfully:', id);
    } catch (error) {
      console.error('CatalogService: Error deleting item:', error);
      throw error;
    }
  }

  /**
   * Searches for catalog items by name for the current tenant.
   * @param searchTerm The term to search for.
   * @returns An Observable of an array of matching catalog items.
   */
  searchCatalogItems(searchTerm: string): Observable<CatalogItem[]> {
    return this.authService.currentUser$.pipe(
      switchMap(user => {
        if (!user || !user.tenantId) {
          console.error('CatalogService: Cannot search items, user or tenantId is missing.');
          return of([]);
        }

        const catalogCollectionRef = collection(this.firestore, this.CATALOG_COLLECTION);
        const q = query(catalogCollectionRef, where('tenantId', '==', user.tenantId));

        // Client-side filtering after fetching
        return collectionData(q, { idField: 'id' }).pipe(
          map(items => {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            return (items as CatalogItem[]).filter(item =>
              item.name.toLowerCase().includes(lowerCaseSearchTerm)
            );
          })
        );
      })
    );
  }

  /**
   * Filters catalog items by type for the current tenant.
   * @param type The type to filter by ('SERVICE' or 'PRODUCT').
   * @returns An Observable of filtered catalog items.
   */
  filterByType(type: 'SERVICE' | 'PRODUCT'): Observable<CatalogItem[]> {
    return this.authService.currentUser$.pipe(
      switchMap(user => {
        if (!user || !user.tenantId) {
          console.error('CatalogService: Cannot filter items, user or tenantId is missing.');
          return of([]);
        }

        const catalogCollectionRef = collection(this.firestore, this.CATALOG_COLLECTION);
        const q = query(
          catalogCollectionRef,
          where('tenantId', '==', user.tenantId),
          where('type', '==', type)
        );

        return collectionData(q, { idField: 'id' }) as Observable<CatalogItem[]>;
      })
    );
  }
}
