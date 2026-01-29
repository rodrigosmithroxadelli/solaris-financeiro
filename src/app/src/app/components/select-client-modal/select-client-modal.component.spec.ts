/*
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule, ModalController } from '@ionic/angular';

import { SelectClientModalComponent } from './select-client-modal.component';
import { Firestore } from '@angular/fire/firestore';
import { ClientService } from '../../../../services/client.service';
import { of } from 'rxjs';
import { Client } from '../../../../models/client.model';

describe('SelectClientModalComponent', () => {
  let component: SelectClientModalComponent;
  let fixture: ComponentFixture<SelectClientModalComponent>;
  let modalControllerSpy: jasmine.SpyObj<ModalController>; // Spy for ModalController

  // Mock ClientService
  const clientServiceMock = {
    getClients: jasmine.createSpy('getClients').and.returnValue(of([])),
    searchClients: jasmine.createSpy('searchClients').and.returnValue(of([]))
  };

  // Mock Firestore
  const firestoreMock = {}; 

  beforeEach(waitForAsync(() => {
    // Create a spy object for ModalController
    modalControllerSpy = jasmine.createSpyObj('ModalController', ['dismiss']);

    TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), SelectClientModalComponent],
      providers: [
        { provide: Firestore, useValue: firestoreMock },
        { provide: ClientService, useValue: clientServiceMock },
        { provide: ModalController, useValue: modalControllerSpy } // Provide the spy object
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SelectClientModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
*/
