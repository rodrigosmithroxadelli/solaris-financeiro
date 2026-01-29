/*
import { TestBed } from '@angular/core/testing';
import { CompanyProfileService } from './company-profile.service';
import { AuthService } from './auth.service';
import { Firestore } from '@angular/fire/firestore';
import { of } from 'rxjs';
import { CompanyProfile } from '../models/company-profile.model';
import { User } from '../models/user.model'; // Import User model for better typing

// Define a mock User type that includes tenantId, as expected by the service
interface MockUser extends User {
  tenantId: string;
}

describe('CompanyProfileService', () => {
  let service: CompanyProfileService;
  let authServiceSpy: { currentUser$: typeof AuthService.prototype.currentUser$ };
  let firestoreMock: any; // Using 'any' for Firestore mock as it's a complex object
  let docSpy: jasmine.Spy;
  let docDataSpy: jasmine.Spy;
  let setDocSpy: jasmine.Spy;

  beforeEach(() => {
    // Create spies for Firestore functions.
    // These will be used to track calls to Firestore methods (doc, docData, setDoc)
    // without actually interacting with a real Firestore instance.
    docSpy = jasmine.createSpy('doc');
    docDataSpy = jasmine.createSpy('docData');
    setDocSpy = jasmine.createSpy('setDoc');

    // Mock for the Firestore object itself.
    // We provide our spies as the functions that Firestore would normally expose.
    firestoreMock = {
      doc: docSpy,
      docData: docDataSpy,
      setDoc: setDocSpy,
      // If other Firestore functions were used, they would be mocked here too.
      // e.g., collection: jasmine.createSpy('collection')
    };

    // Create a spy object for AuthService.
    // The `currentUser$` is a property, so we define it in the second argument.
    authServiceSpy = jasmine.createSpyObj('AuthService', [], {
      currentUser$: of({
        id: 'test-user-id',
        tenantId: 'test-tenant-id',
        email: 'test@example.com',
        displayName: 'Test User',
        role: 'admin',
        createdAt: new Date().toISOString()
      } as MockUser) // Explicitly cast to MockUser for tenantId property
    });

    TestBed.configureTestingModule({
      providers: [
        CompanyProfileService,
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Firestore, useValue: firestoreMock } // Provide our mock Firestore object
      ]
    });
    service = TestBed.inject(CompanyProfileService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('saveCompanyProfile', () => {
    it('should call setDoc with the correct parameters', async () => {
      // Override currentUser$ for this specific test case if needed, otherwise the default mock is used
      authServiceSpy.currentUser$ = of({ id: 'user1', tenantId: 'tenant1' } as MockUser);

      const profile: CompanyProfile = {
        tenantId: 'tenant1',
        name: 'Test Company',
        contactPhone: '1234567890'
      };

      // Mock a document reference object that `docSpy` would return
      const expectedDocRef = { __isFirestoreDocumentRef: true, path: 'companyProfiles/tenant1' };
      docSpy.and.returnValue(expectedDocRef);
      setDocSpy.and.returnValue(Promise.resolve()); // Mock the promise resolution of setDoc

      await service.saveCompanyProfile(profile);

      // Verify that docSpy was called with the correct arguments
      expect(docSpy).toHaveBeenCalledWith(firestoreMock, 'companyProfiles', 'tenant1');
      // Verify that setDocSpy was called with the mocked document reference and profile data
      expect(setDocSpy).toHaveBeenCalledWith(expectedDocRef, {
        tenantId: 'tenant1',
        name: 'Test Company',
        contactPhone: '1234567890'
      });
    });

    it('should throw an error if tenantId is missing from current user', async () => {
      authServiceSpy.currentUser$ = of(null); // Simulate no user logged in
      const profile: CompanyProfile = { tenantId: 'some-tenant', name: 'Test Company' }; // tenantId is in profile, but not in user

      // Jasmine's way to test for rejected promises
      await expectAsync(service.saveCompanyProfile(profile)).toBeRejectedWith(
        new Error('Tenant ID é necessário para salvar um perfil de empresa.')
      );
    });

    it('should throw an error if profile tenantId mismatches current user tenantId', async () => {
      authServiceSpy.currentUser$ = of({ id: 'user1', tenantId: 'tenant1' } as MockUser);
      const profile: CompanyProfile = { tenantId: 'mismatch-tenant', name: 'Test Company' }; // Different tenantId

      await expectAsync(service.saveCompanyProfile(profile)).toBeRejectedWith(
        new Error('O Tenant ID no perfil deve corresponder ao usuário autenticado.')
      );
    });
  });

  describe('getCompanyProfile', () => {
    it('should return company profile data', (done) => {
      authServiceSpy.currentUser$ = of({ id: 'user1', tenantId: 'tenant1' } as MockUser);
      const mockProfile: CompanyProfile = { id: 'tenant1', tenantId: 'tenant1', name: 'My Company' };
      
      const expectedDocRef = { __isFirestoreDocumentRef: true, path: 'companyProfiles/tenant1' };
      docSpy.and.returnValue(expectedDocRef);
      docDataSpy.and.returnValue(of(mockProfile)); // docData returns an Observable

      service.getCompanyProfile().subscribe(profile => {
        expect(profile).toEqual(mockProfile);
        expect(docSpy).toHaveBeenCalledWith(firestoreMock, 'companyProfiles', 'tenant1');
        expect(docDataSpy).toHaveBeenCalledWith(expectedDocRef, { idField: 'id' });
        done(); // Finalize the asynchronous test
      });
    });

    it('should return null if no user is logged in', (done) => {
      authServiceSpy.currentUser$ = of(null); // Simulate no user logged in

      service.getCompanyProfile().subscribe(profile => {
        expect(profile).toBeNull();
        done();
      });
    });

    it('should return null if docData returns null', (done) => {
      authServiceSpy.currentUser$ = of({ id: 'user1', tenantId: 'tenant1' } as MockUser);
      const expectedDocRef = { __isFirestoreDocumentRef: true, path: 'companyProfiles/tenant1' };
      docSpy.and.returnValue(expectedDocRef);
      docDataSpy.and.returnValue(of(null)); // docData returns null

      service.getCompanyProfile().subscribe(profile => {
        expect(profile).toBeNull();
        done();
      });
    });
  });
});
*/
