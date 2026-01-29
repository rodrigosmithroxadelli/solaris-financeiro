/*
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule, ModalController, AlertController } from '@ionic/angular';

import { SelectVehicleModalComponent } from './select-vehicle-modal.component';
import { Firestore } from '@angular/fire/firestore';
import { ClientService } from '../../../../services/client.service';
import { of } from 'rxjs';
import { Client } from '../../../../models/client.model';

describe('SelectVehicleModalComponent', () => {
  let component: SelectVehicleModalComponent;
  let fixture: ComponentFixture<SelectVehicleModalComponent>;
  let modalControllerSpy: jasmine.SpyObj<ModalController>;
  let alertControllerSpy: jasmine.SpyObj<AlertController>;
  let alertElementSpy: jasmine.SpyObj<HTMLIonAlertElement>; // Spy for the HTMLIonAlertElement

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
    saveClient: jasmine.createSpy('saveClient').and.returnValue(Promise.resolve()),
  };

  // Mock Firestore
  const firestoreMock = {}; 

  beforeEach(waitForAsync(() => {
    // Create spy objects
    modalControllerSpy = jasmine.createSpyObj('ModalController', ['dismiss']);
    alertElementSpy = jasmine.createSpyObj('HTMLIonAlertElement', ['present', 'onDidDismiss']); // Spy for the alert element
    alertControllerSpy = jasmine.createSpyObj('AlertController', ['create']);

    // Mock for alertControllerSpy.create to return the alertElementSpy
    alertControllerSpy.create.and.returnValue(Promise.resolve(alertElementSpy)); // Return the actual element spy
    alertElementSpy.onDidDismiss.and.returnValue(Promise.resolve({ role: 'cancel' })); // Default dismiss role

    TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), SelectVehicleModalComponent],
      providers: [
        { provide: Firestore, useValue: firestoreMock },
        { provide: ClientService, useValue: clientServiceMock },
        { provide: ModalController, useValue: modalControllerSpy },
        { provide: AlertController, useValue: alertControllerSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SelectVehicleModalComponent);
    component = fixture.componentInstance;
    component.clientId = 'testClientId';
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
*/
