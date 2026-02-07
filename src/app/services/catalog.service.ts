import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, addDoc, query, doc, setDoc, updateDoc, where, deleteDoc, getDocs, getDoc, limit, startAfter, orderBy } from '@angular/fire/firestore';
import { Observable, of, firstValueFrom, shareReplay, BehaviorSubject, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { CatalogItem } from '../models/catalog.model';
import { AuthService } from './auth.service';
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class CatalogService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private environmentInjector = inject(EnvironmentInjector);

  private readonly CATALOG_COLLECTION = 'catalogItems'; // Top-level collection for catalog items
  private readonly PAGE_SIZE = 20;
  private catalogCache$?: Observable<CatalogItem[]>;
  private catalogSubject = new BehaviorSubject<CatalogItem[]>([]);
  private catalogLastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
  private catalogHasMore = true;
  private catalogLoading = false;
  private searchLastDocByTerm = new Map<string, QueryDocumentSnapshot<DocumentData> | null>();
  private searchHasMoreByTerm = new Map<string, boolean>();
  private filterLastDocByType = new Map<'SERVICE' | 'PRODUCT', QueryDocumentSnapshot<DocumentData> | null>();
  private filterHasMoreByType = new Map<'SERVICE' | 'PRODUCT', boolean>();

  /**
   * Retrieves all catalog items for the current tenant in real-time.
   */
  getCatalogItems(): Observable<CatalogItem[]> {
    if (this.catalogCache$) {
      void this.loadNextCatalogPage();
      return this.catalogCache$;
    }
    this.catalogCache$ = this.catalogSubject.asObservable().pipe(
      shareReplay({ bufferSize: 1, refCount: false })
    );
    void this.loadNextCatalogPage();
    return this.catalogCache$;
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
        return from(this.getCatalogItemByIdOnce(user.tenantId, id));
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

    const catalogCollectionRef = runInInjectionContext(this.environmentInjector, () =>
      collection(this.firestore, 'empresas', tenantId, this.CATALOG_COLLECTION)
    );
    let itemId = item.id;

    const itemToSave: CatalogItem = { ...item, tenantId: tenantId };

    try {
      if (itemId) {
        // Update existing item
        const docRef = runInInjectionContext(this.environmentInjector, () =>
          doc(catalogCollectionRef, itemId)
        );
        await runInInjectionContext(this.environmentInjector, () =>
          updateDoc(docRef, itemToSave as Partial<CatalogItem>)
        );
        console.log('CatalogService: Item updated successfully:', itemId);
      } else {
        // Create new item
        const newDocRef = await runInInjectionContext(this.environmentInjector, () =>
          addDoc(catalogCollectionRef, itemToSave as CatalogItem)
        );
        itemId = newDocRef.id;
        console.log('CatalogService: New item created successfully with ID:', itemId);
      }
      this.catalogCache$ = undefined;
      this.catalogSubject.next([]);
      this.catalogLastDoc = null;
      this.catalogHasMore = true;
      this.catalogLoading = false;
      this.searchLastDocByTerm.clear();
      this.searchHasMoreByTerm.clear();
      this.filterLastDocByType.clear();
      this.filterHasMoreByType.clear();
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
        const itemDocRef = runInInjectionContext(this.environmentInjector, () =>
          doc(this.firestore, 'empresas', currentUser.tenantId, this.CATALOG_COLLECTION, id)
        );
      await runInInjectionContext(this.environmentInjector, () =>
        deleteDoc(itemDocRef)
      );
      this.catalogCache$ = undefined;
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
        return from(this.searchCatalogItemsOnce(user.tenantId, searchTerm));
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
        return from(this.filterCatalogItemsByTypeOnce(user.tenantId, type));
      })
    );
  }

  private async loadNextCatalogPage(): Promise<void> {
    if (this.catalogLoading || !this.catalogHasMore) {
      return;
    }
    this.catalogLoading = true;
    const currentUser = await firstValueFrom(this.authService.currentUser$);
    if (!currentUser || !currentUser.tenantId) {
      console.error('CatalogService: Cannot get items, user or tenantId is missing.');
      this.catalogLoading = false;
      return;
    }
    const catalogCollectionRef = runInInjectionContext(this.environmentInjector, () =>
      collection(this.firestore, 'empresas', currentUser.tenantId, this.CATALOG_COLLECTION)
    );
    const constraints: Array<ReturnType<typeof where> | ReturnType<typeof orderBy> | ReturnType<typeof limit> | ReturnType<typeof startAfter>> = [
      where('tenantId', '==', currentUser.tenantId),
      orderBy('__name__'),
      limit(this.PAGE_SIZE)
    ];
    if (this.catalogLastDoc) {
      constraints.push(startAfter(this.catalogLastDoc));
    }
    const q = query(catalogCollectionRef, ...constraints);
    const snapshot = await runInInjectionContext(this.environmentInjector, () =>
      getDocs(q)
    );
    const newItems = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as CatalogItem) }));
    this.catalogLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : this.catalogLastDoc;
    this.catalogHasMore = snapshot.docs.length === this.PAGE_SIZE;
    this.catalogSubject.next([...this.catalogSubject.value, ...newItems]);
    this.catalogLoading = false;
  }

  private async getCatalogItemByIdOnce(tenantId: string, id: string): Promise<CatalogItem> {
    const itemDocRef = runInInjectionContext(this.environmentInjector, () =>
      doc(this.firestore, 'empresas', tenantId, this.CATALOG_COLLECTION, id)
    );
    const itemDocSnap = await runInInjectionContext(this.environmentInjector, () =>
      getDoc(itemDocRef)
    );
    if (itemDocSnap.exists()) {
      const itemData = itemDocSnap.data() as CatalogItem;
      if (itemData.tenantId === tenantId) {
        return { id: itemDocSnap.id, ...itemData };
      }
    }
    return {} as CatalogItem;
  }

  private async searchCatalogItemsOnce(tenantId: string, searchTerm: string): Promise<CatalogItem[]> {
    const normalizedTerm = searchTerm.toLowerCase();
    const lastDoc = this.searchLastDocByTerm.get(normalizedTerm) ?? null;
    const hasMore = this.searchHasMoreByTerm.get(normalizedTerm) ?? true;
    if (!hasMore) {
      return [];
    }
    const catalogCollectionRef = runInInjectionContext(this.environmentInjector, () =>
      collection(this.firestore, 'empresas', tenantId, this.CATALOG_COLLECTION)
    );
    const constraints: Array<ReturnType<typeof where> | ReturnType<typeof orderBy> | ReturnType<typeof limit> | ReturnType<typeof startAfter>> = [
      where('tenantId', '==', tenantId),
      orderBy('__name__'),
      limit(this.PAGE_SIZE)
    ];
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }
    const q = query(catalogCollectionRef, ...constraints);
    const snapshot = await runInInjectionContext(this.environmentInjector, () =>
      getDocs(q)
    );
    const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : lastDoc;
    this.searchLastDocByTerm.set(normalizedTerm, newLastDoc ?? null);
    this.searchHasMoreByTerm.set(normalizedTerm, snapshot.docs.length === this.PAGE_SIZE);
    return snapshot.docs
      .map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as CatalogItem) }))
      .filter(item => item.name.toLowerCase().includes(normalizedTerm));
  }

  private async filterCatalogItemsByTypeOnce(tenantId: string, type: 'SERVICE' | 'PRODUCT'): Promise<CatalogItem[]> {
    const lastDoc = this.filterLastDocByType.get(type) ?? null;
    const hasMore = this.filterHasMoreByType.get(type) ?? true;
    if (!hasMore) {
      return [];
    }
    const catalogCollectionRef = runInInjectionContext(this.environmentInjector, () =>
      collection(this.firestore, 'empresas', tenantId, this.CATALOG_COLLECTION)
    );
    const constraints: Array<ReturnType<typeof where> | ReturnType<typeof orderBy> | ReturnType<typeof limit> | ReturnType<typeof startAfter>> = [
      where('tenantId', '==', tenantId),
      where('type', '==', type),
      orderBy('__name__'),
      limit(this.PAGE_SIZE)
    ];
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }
    const q = query(catalogCollectionRef, ...constraints);
    const snapshot = await runInInjectionContext(this.environmentInjector, () =>
      getDocs(q)
    );
    const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : lastDoc;
    this.filterLastDocByType.set(type, newLastDoc ?? null);
    this.filterHasMoreByType.set(type, snapshot.docs.length === this.PAGE_SIZE);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as CatalogItem) }));
  }
}
