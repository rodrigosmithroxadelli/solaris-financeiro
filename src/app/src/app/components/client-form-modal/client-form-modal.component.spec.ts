import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { ModalController, AlertController } from '@ionic/angular/standalone';
import { Firestore } from '@angular/fire/firestore';
import { ClientService } from '../../../../services/client.service';
import { AuthService } from '../../../../services/auth.service';
import { of } from 'rxjs';

import { ClientFormModalComponent } from './client-form-modal.component';

describe('ClientFormModalComponent', () => {
  let component: ClientFormModalComponent;
  let fixture: ComponentFixture<ClientFormModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IonicModule.forRoot(), ClientFormModalComponent],
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: ClientService, useValue: { saveClient: jasmine.createSpy('saveClient') } },
        { provide: AuthService, useValue: { currentUser$: of(null) } },
        { provide: ModalController, useValue: { dismiss: jasmine.createSpy('dismiss') } },
        { provide: AlertController, useValue: { create: jasmine.createSpy('create') } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ClientFormModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
