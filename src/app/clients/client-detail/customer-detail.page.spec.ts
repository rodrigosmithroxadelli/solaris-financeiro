/*
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClientDetailPage } from './client-detail.page';
import { ActivatedRoute } from '@angular/router'; // Import ActivatedRoute
import { of } from 'rxjs'; // Import of for observables
import { Firestore } from '@angular/fire/firestore'; // Import Firestore
import { ClientService } from '../../services/client.service'; // Import ClientService
import { Client } from '../../models/client.model'; // Import Client model

describe('ClientDetailPage', () => {
  let component: ClientDetailPage;
  let fixture: ComponentFixture<ClientDetailPage>;

  // Mock ActivatedRoute para simular parâmetros de rota
  const activatedRouteMock = {
    snapshot: { 
      paramMap: { 
        get: (key: string) => 'testClientId' // Mock paramMap.get para retornar um ID de teste
      }
    },
    paramMap: of({ get: (key: string) => 'testClientId' }) // Mock paramMap como um Observable
  };

  // Mock ClientService
  const mockClient: Client = {
    id: 'testClientId',
    tenantId: 'testTenantId',
    name: 'Test Client',
    email: 'test@example.com',
    whatsapp: '123456789',
    vehicles: []
  };
  const clientServiceMock = {
    getClientById: jasmine.createSpy('getClientById').and.returnValue(of(mockClient)),
    // Adicione outros métodos que ClientDetailPage possa usar de ClientService, se necessário
  };

  // Mock Firestore
  const firestoreMock = {}; 

  beforeEach(async () => { // Usar async para esperar a configuração do módulo
    await TestBed.configureTestingModule({
      imports: [ClientDetailPage], // Importar o componente como standalone
      providers: [
        { provide: ActivatedRoute, useValue: activatedRouteMock }, // Fornece o mock do ActivatedRoute
        { provide: Firestore, useValue: firestoreMock }, // Fornece o mock do Firestore
        { provide: ClientService, useValue: clientServiceMock } // Fornece o mock do ClientService
      ]
    }).compileComponents();
    
    fixture = TestBed.createComponent(ClientDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
*/
