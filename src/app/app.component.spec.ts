import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { Firestore } from '@angular/fire/firestore'; // Import Firestore
import { AuthService } from './services/auth.service'; // Import AuthService
import { of } from 'rxjs'; // Import of from rxjs for observables
import { SwUpdate } from '@angular/service-worker'; // Import SwUpdate

describe('AppComponent', () => {
  // Mock AuthService para simular o comportamento de login/logout e o usuário atual
  const authServiceMock = {
    currentUser$: of(null), // Começa com um usuário nulo, pode ser ajustado conforme o teste
    logout: jasmine.createSpy('logout') // Espia o método logout
    // Adicione outros métodos/propriedades que o AppComponent possa usar do AuthService, se necessário
  };

  // Mock Firestore, um objeto vazio é suficiente se o teste não interagir profundamente com ele
  const firestoreMock = {}; 

  // Mock SwUpdate para simular o Service Worker
  const swUpdateMock = {
    isEnabled: false, // Assume que o service worker não está habilitado para testes
    available: of(null), // Observável para atualizações disponíveis
    activated: of(null), // Observável para atualizações ativadas
    checkForUpdate: jasmine.createSpy('checkForUpdate').and.returnValue(Promise.resolve()), // Espia checkForUpdate
    activateUpdate: jasmine.createSpy('activateUpdate').and.returnValue(Promise.resolve()) // Espia activateUpdate
    // Adicione outros métodos/propriedades que o AppComponent possa usar de SwUpdate, se necessário
  };

  it('should create the app', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]), // Provedor para o roteador, já existente
        { provide: Firestore, useValue: firestoreMock }, // Fornece o mock do Firestore
        { provide: AuthService, useValue: authServiceMock }, // Fornece o mock do AuthService
        { provide: SwUpdate, useValue: swUpdateMock } // Fornece o mock do SwUpdate
      ]
    }).compileComponents();
    
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});

