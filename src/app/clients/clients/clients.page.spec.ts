import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClientsPage } from './clients.page';
import { Firestore } from '@angular/fire/firestore'; // Import Firestore
import { ModalController } from '@ionic/angular/standalone';
import { ClientService } from '../../services/client.service'; // Corrected Import ClientService
import { of } from 'rxjs'; // Import of for observables

describe('ClientsPage', () => {
  let component: ClientsPage;
  let fixture: ComponentFixture<ClientsPage>;

  // Mock ClientService para simular o comportamento de busca de clientes
  const clientServiceMock = {
    getClients: jasmine.createSpy('getClients').and.returnValue(of([])), // Retorna um Observable de array vazio de clientes
    // Adicione outros métodos/propriedades que ClientsPage possa usar de ClientService, se necessário
  };

  // Mock Firestore, um objeto vazio é suficiente para a maioria dos testes
  const firestoreMock = {};
  const modalControllerMock = {
    create: jasmine.createSpy('create')
  };

  beforeEach(async () => { // Usar async para esperar a configuração do módulo
    await TestBed.configureTestingModule({
      imports: [ClientsPage], // Garante que ClientsPage seja importado como standalone
      providers: [
        { provide: Firestore, useValue: firestoreMock }, // Fornece o mock do Firestore
        { provide: ClientService, useValue: clientServiceMock }, // Fornece o mock do ClientService
        { provide: ModalController, useValue: modalControllerMock }
      ]
    }).compileComponents();
    
    fixture = TestBed.createComponent(ClientsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
