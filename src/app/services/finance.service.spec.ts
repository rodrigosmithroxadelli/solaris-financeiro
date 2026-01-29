/*
import { TestBed } from '@angular/core/testing';
import { FinanceService } from './finance.service';
import { Firestore } from '@angular/fire/firestore';
import { CollectionReference, DocumentReference } from '@angular/fire/firestore'; // Importa tipos para cast

describe('FinanceService', () => {
  let service: FinanceService;
  let firestoreSpy: jasmine.SpyObj<Firestore>; // Usa SpyObj para Firestore

  beforeEach(() => {
    // Cria um objeto spy para Firestore.
    // Lista todos os métodos que FinanceService chama na instância de Firestore ou
    // funções do @angular/fire/firestore que recebem Firestore como primeiro argumento.
    // Para simplicidade, listamos os comuns.
    firestoreSpy = jasmine.createSpyObj('Firestore', [
      'collection', // finance.service pode usar collection
      'addDoc',     // finance.service pode usar addDoc
      'doc',        // finance.service pode usar doc
      'updateDoc',  // finance.service pode usar updateDoc
      'deleteDoc',  // finance.service pode usar deleteDoc
      // Adicione outros métodos/funções conforme necessário pelo FinanceService
    ]);

    // Simula os valores de retorno para os métodos/funções espionados
    // Isso garante que as chamadas dentro do FinanceService não falhem
    firestoreSpy.collection.and.returnValue({} as CollectionReference); // collection retorna CollectionReference
    firestoreSpy.addDoc.and.returnValue(Promise.resolve({} as DocumentReference)); // addDoc retorna Promise de DocumentReference
    firestoreSpy.doc.and.returnValue({} as DocumentReference); // doc retorna DocumentReference
    firestoreSpy.updateDoc.and.returnValue(Promise.resolve()); // updateDoc retorna Promise vazia
    firestoreSpy.deleteDoc.and.returnValue(Promise.resolve()); // deleteDoc retorna Promise vazia


    TestBed.configureTestingModule({
      providers: [
        FinanceService,
        { provide: Firestore, useValue: firestoreSpy } // Fornece o objeto spy para Firestore
      ]
    });
    service = TestBed.inject(FinanceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    // Opcional: Você pode adicionar aqui um expect para verificar se firestoreSpy.collection foi chamado
    // se o construtor do FinanceService fizer alguma chamada inicial ao Firestore.
  });
});
*/
