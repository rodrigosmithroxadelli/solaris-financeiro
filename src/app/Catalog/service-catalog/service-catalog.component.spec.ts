import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ServiceCatalogComponent } from './service-catalog.component';
import { IonicModule, ToastController, AlertController } from '@ionic/angular';
import { CatalogService } from '../../services/catalog.service';
import { AuthService } from '../../services/auth.service';
import { of } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CatalogItem } from '../../models/catalog.model';

describe('ServiceCatalogComponent', () => {
  let component: ServiceCatalogComponent;
  let fixture: ComponentFixture<ServiceCatalogComponent>;
  let mockCatalogService: jasmine.SpyObj<CatalogService>;
  let mockAuthService: any;
  let mockToastController: jasmine.SpyObj<ToastController>;
  let mockAlertController: jasmine.SpyObj<AlertController>;
  let toastSpy: jasmine.SpyObj<HTMLIonToastElement>;
  let alertSpy: jasmine.SpyObj<HTMLIonAlertElement>;

  const mockCatalogItems: CatalogItem[] = [
    { id: '1', tenantId: 'test', name: 'Item 1', type: 'SERVICE', unitPrice: 100, costPrice: 50 },
    { id: '2', tenantId: 'test', name: 'Item 2', type: 'PRODUCT', unitPrice: 200, costPrice: 100 },
  ];

  beforeEach(async () => {
    // Cria objetos spy para serviços
    mockCatalogService = jasmine.createSpyObj('CatalogService', ['getCatalogItems', 'saveCatalogItem', 'deleteCatalogItem']);
    mockAuthService = {
      currentUser$: of({ uid: 'test-user', tenantId: 'test' }),
    };

    // Cria objetos spy para os controladores Ionic
    toastSpy = jasmine.createSpyObj('HTMLIonToastElement', ['present']);
    alertSpy = jasmine.createSpyObj('HTMLIonAlertElement', ['present']);
    mockToastController = jasmine.createSpyObj('ToastController', {
      create: Promise.resolve(toastSpy)
    });
    mockAlertController = jasmine.createSpyObj('AlertController', {
      create: Promise.resolve(alertSpy)
    });

    // Configura os valores de retorno para os spies
    mockCatalogService.getCatalogItems.and.returnValue(of(mockCatalogItems));
    mockCatalogService.saveCatalogItem.and.resolveTo(undefined);
    mockCatalogService.deleteCatalogItem.and.resolveTo(undefined);

    await TestBed.configureTestingModule({
      imports: [
        ServiceCatalogComponent,
        IonicModule.forRoot(),
        FormsModule,
        CommonModule,
        NoopAnimationsModule
      ],
      providers: [
        { provide: CatalogService, useValue: mockCatalogService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ToastController, useValue: mockToastController },
        { provide: AlertController, useValue: mockAlertController },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ServiceCatalogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load catalog items on init', () => {
    expect(mockCatalogService.getCatalogItems).toHaveBeenCalled();
    expect(component.catalogItems.length).toBe(2);
    expect(component.filteredItems.length).toBe(2);
  });

  it('should filter items by type', () => {
    component.selectedType = 'SERVICE';
    component.applyFilters();
    expect(component.filteredItems.length).toBe(1);
    expect(component.filteredItems[0].type).toBe('SERVICE');
  });

  it('should filter items by search term', () => {
    component.searchTerm = 'Item 1';
    component.applyFilters();
    expect(component.filteredItems.length).toBe(1);
    expect(component.filteredItems[0].name).toBe('Item 1');
  });

  it('should open and close the item modal', () => {
    component.openAddItemModal();
    expect(component.showItemModal).toBe(true);
    component.closeItemModal();
    expect(component.showItemModal).toBe(false);
  });

  /*
  it('should save an item and show a toast', async () => {
    component.openAddItemModal();
    component.formItem = { ...mockCatalogItems[0] };
    await component.saveItem();
    expect(mockCatalogService.saveCatalogItem).toHaveBeenCalledWith(component.formItem);
    // Verificamos a mensagem correta, que provavelmente é "Item salvo com sucesso!"
    expect(mockToastController.create).toHaveBeenCalledWith({
      message: 'Item salvo com sucesso!',
      duration: 2000,
      color: 'success',
      position: 'top',
    });
    expect(toastSpy.present).toHaveBeenCalled();
  });

  it('should delete an item after confirmation and show a toast', fakeAsync(() => {
    // Espiamos o método 'create' do controlador de alerta
    // e fornecemos uma implementação falsa que nos permite encontrar e chamar o handler do botão 'destructive'
    mockAlertController.create.and.callFake(async (options: any) => {
      const deleteHandler = options.buttons.find((b: any) => b.role === 'destructive').handler;
      // Chamamos manualmente o handler para simular o clique do usuário em 'Excluir'
      if (deleteHandler) {
        await deleteHandler();
      }
      return alertSpy; // Retorna o spy para o elemento de alerta
    });

    component.deleteItem(mockCatalogItems[0]); // Chama o método do componente
    tick(); // Avança o relógio para resolver as promessas dentro da zona fakeAsync

    expect(mockAlertController.create).toHaveBeenCalled();
    expect(alertSpy.present).toHaveBeenCalled();
    expect(mockCatalogService.deleteCatalogItem).toHaveBeenCalledWith('1');
    expect(mockToastController.create).toHaveBeenCalledWith({
      message: 'Item excluído com sucesso!',
      duration: 2000,
      color: 'success',
      position: 'top',
    });
    expect(toastSpy.present).toHaveBeenCalled();
  }));
  */
});
