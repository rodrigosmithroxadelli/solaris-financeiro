import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule, ToastController, AlertController, ModalController } from '@ionic/angular'; // Adicionado ModalController
import { CatalogManagementPage } from './catalog-management.page';
import { Firestore } from '@angular/fire/firestore'; // Import Firestore
import { CatalogService } from '../../../../services/catalog.service'; // Import CatalogService (caminho corrigido)
import { of } from 'rxjs';
import { CatalogItem } from '../../../../models/catalog.model'; // Import CatalogItem model

describe('CatalogManagementPage', () => {
  let component: CatalogManagementPage;
  let fixture: ComponentFixture<CatalogManagementPage>;

  // Mock CatalogService
  const mockCatalogItems: CatalogItem[] = [
    { id: '1', tenantId: 'test', name: 'Service 1', type: 'SERVICE', unitPrice: 100 },
    { id: '2', tenantId: 'test', name: 'Product 1', type: 'PRODUCT', unitPrice: 50 },
  ];
  const catalogServiceMock = {
    getCatalogItems: jasmine.createSpy('getCatalogItems').and.returnValue(of(mockCatalogItems)),
    saveCatalogItem: jasmine.createSpy('saveCatalogItem').and.returnValue(Promise.resolve()),
    deleteCatalogItem: jasmine.createSpy('deleteCatalogItem').and.returnValue(Promise.resolve()),
  };

  // Mock Firestore
  const firestoreMock = {}; 

  // Mock ToastController
  const toastControllerMock = {
    create: jasmine.createSpy('create').and.returnValue(Promise.resolve({
      present: jasmine.createSpy('present')
    }))
  };

  // Mock AlertController
  const alertControllerMock = {
    create: jasmine.createSpy('create').and.returnValue(Promise.resolve({
      present: jasmine.createSpy('present'),
      onDidDismiss: jasmine.createSpy('onDidDismiss').and.returnValue(Promise.resolve({ role: 'cancel' }))
    }))
  };

  beforeEach(waitForAsync(async () => {
    TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), CatalogManagementPage],
      providers: [
        { provide: Firestore, useValue: firestoreMock },
        { provide: CatalogService, useValue: catalogServiceMock },
        { provide: ToastController, useValue: toastControllerMock },
        { provide: AlertController, useValue: alertControllerMock },
        { provide: ModalController, useValue: {} } // Fornece um mock mínimo para ModalController
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CatalogManagementPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
