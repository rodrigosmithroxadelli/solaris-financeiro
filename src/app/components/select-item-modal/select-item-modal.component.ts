// src/app/components/select-item-modal/select-item-modal.component.ts
import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSearchbar,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonButtons,
  ModalController
} from '@ionic/angular/standalone';
import { CatalogService } from '../../services/catalog.service';
import { CatalogItem } from '../../models/catalog.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-select-item-modal',
  templateUrl: './select-item-modal.component.html',
  styleUrls: ['./select-item-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSearchbar,
    IonList,
    IonItem,
    IonLabel,
    IonButton,
    IonButtons
  ]
})
export class SelectItemModalComponent implements OnInit {
  private catalogService = inject(CatalogService);
  private modalCtrl = inject(ModalController);
  private destroyRef = inject(DestroyRef);

  allItems: CatalogItem[] = [];
  filteredItems: CatalogItem[] = [];
  searchTerm: string = '';
  private hasLoadedItems = false;

  ngOnInit() {
    if (this.hasLoadedItems) {
      return;
    }
    this.hasLoadedItems = true;
    this.catalogService.getCatalogItems()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(items => {
        this.allItems = items;
        this.filteredItems = items;
      });
  }

  filterItems() {
    const term = this.searchTerm.toLowerCase();
    this.filteredItems = this.allItems.filter(item =>
      item.name.toLowerCase().includes(term)
    );
  }

  selectItem(item: CatalogItem) {
    this.modalCtrl.dismiss(item, 'confirm');
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }
}
