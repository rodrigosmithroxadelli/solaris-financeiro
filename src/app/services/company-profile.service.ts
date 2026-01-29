import { Injectable, inject } from '@angular/core';
import { Firestore, doc, docData, setDoc, updateDoc, collection } from '@angular/fire/firestore';
import { Observable, firstValueFrom, of, switchMap } from 'rxjs';
import { CompanyProfile } from '../models/company-profile.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class CompanyProfileService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  private readonly COMPANY_PROFILE_COLLECTION = 'companyProfiles'; // Coleção de nível superior para perfis de empresa

  /**
   * Recupera o perfil da empresa para o tenant atual.
   * O ID do documento do perfil da empresa é o próprio tenantId.
   */
  getCompanyProfile(): Observable<CompanyProfile | null> {
    return this.authService.currentUser$.pipe(
      switchMap(user => {
        if (!user || !user.tenantId) {
          console.warn('CompanyProfileService: Não foi possível obter o perfil da empresa, usuário ou tenantId ausente.');
          return of(null);
        }
        const profileDocRef = doc(this.firestore, this.COMPANY_PROFILE_COLLECTION, user.tenantId);
        return docData(profileDocRef, { idField: 'id' }) as Observable<CompanyProfile | null>;
      })
    );
  }

  /**
   * Salva ou atualiza o perfil da empresa para o tenant atual.
   * Usa o tenantId como ID do documento.
   * @param profile O objeto do perfil da empresa a ser salvo.
   */
  async saveCompanyProfile(profile: CompanyProfile): Promise<void> {
    const currentUser = await firstValueFrom(this.authService.currentUser$);
    const tenantId = currentUser?.tenantId;

    if (!tenantId) {
      console.error('CompanyProfileService: Não foi possível salvar o perfil da empresa, tenantId ausente.');
      throw new Error('Tenant ID é necessário para salvar um perfil de empresa.');
    }

    // Garante que o tenantId no perfil corresponda ao tenantId do usuário atual
    if (profile.tenantId && profile.tenantId !== tenantId) {
      console.error('CompanyProfileService: Incompatibilidade do tenantId do perfil com o usuário atual.');
      throw new Error('O Tenant ID no perfil deve corresponder ao usuário autenticado.');
    }

    // Usa o tenantId como o ID do documento
    const profileDocRef = doc(this.firestore, this.COMPANY_PROFILE_COLLECTION, tenantId);

    try {
      // setDoc criará o documento se não existir ou o substituirá se existir.
      await setDoc(profileDocRef, { ...profile, tenantId: tenantId });
      console.log('CompanyProfileService: Perfil da empresa salvo com sucesso para o tenant:', tenantId);
    } catch (error) {
      console.error('CompanyProfileService: Erro ao salvar o perfil da empresa:', error);
      throw error;
    }
  }
}
