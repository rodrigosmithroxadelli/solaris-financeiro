import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonList,
  IonBadge,
  IonSelect,
  IonSelectOption,
  IonModal,
  IonButtons,
  AlertController,
  ToastController
} from '@ionic/angular/standalone';
import { AuthService } from '../services/auth.service';
import { StorageService } from '../services/storage.service';
import { User } from '../models/user.model';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { addIcons } from 'ionicons';
import { personAdd, create, trash, logOut, shieldCheckmark, person, lockClosed, business, settings } from 'ionicons/icons';
import { CompanyProfile } from '../models/company-profile.model'; // Import CompanyProfile model
import { CompanyProfileService } from '../services/company-profile.service'; // Import CompanyProfileService

@Component({
  selector: 'app-admin',
  templateUrl: 'admin.page.html',
  styleUrls: ['admin.page.scss'],
  standalone: true,
  imports: [
    IonButtons,
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonIcon,
    IonList,
    IonBadge,
    IonSelect,
    IonSelectOption,
    IonModal
  ]
})
export class AdminPage implements OnInit {
  private authService = inject(AuthService);
  private storageService = inject(StorageService);
  private router = inject(Router);
  private alertController = inject(AlertController);
  private toastController = inject(ToastController);
  private companyProfileService = inject(CompanyProfileService); // Inject CompanyProfileService
  private destroyRef = inject(DestroyRef);

  users: User[] = [];
  currentUser: User | null = null;
  currentCompanyProfile: CompanyProfile | null = null; // Property to hold the loaded company profile
  companyProfileForm: Partial<CompanyProfile> = { // Form model for company profile
    name: '',
    contactPhone: '',
    contactEmail: '',
    address: ''
  };
  
  // Modal de novo/editar usuário
  showUserModal: boolean = false;
  editingUser: User | null = null;
  newUser: Partial<User> = {
    email: '', // Use email instead of username
    // password is not part of the User model directly, but needed for registration/update
    displayName: '', // Use displayName instead of name
    role: 'user'
  };

  constructor() {
    addIcons({ personAdd, create, trash, logOut, shieldCheckmark, person, lockClosed, business, settings }); // Added 'settings' icon
  }

  ngOnInit() {
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(user => {
        this.currentUser = user;
      });
    this.loadUsers();
    this.loadCompanyProfile(); // Load company profile when the page initializes
  }

  loadCompanyProfile() {
    this.companyProfileService.getCompanyProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(profile => {
        if (profile) {
          this.currentCompanyProfile = profile;
          // Populate the form with existing data
          this.companyProfileForm = { ...profile };
        } else {
          // If no profile exists, ensure form is empty
          this.companyProfileForm = {
            name: '',
            contactPhone: '',
            contactEmail: '',
            address: ''
          };
        }
      });
  }

  async saveCompanyProfile() {
    if (!this.companyProfileForm.name) {
      await this.showToast('O nome da empresa é obrigatório.', 'warning');
      return;
    }

    try {
      const currentUserAuth = await firstValueFrom(this.authService.currentUser$);
      if (!currentUserAuth?.tenantId) {
        await this.showToast('Tenant ID não encontrado para o usuário atual.', 'danger');
        return;
      }

      const profileToSave: Partial<CompanyProfile> = {
        tenantId: currentUserAuth.tenantId,
        name: this.companyProfileForm.name,
        contactPhone: this.companyProfileForm.contactPhone,
        contactEmail: this.companyProfileForm.contactEmail,
        address: this.companyProfileForm.address,
        id: this.currentCompanyProfile?.id
      };

      // Clean the object to remove any keys with undefined values before saving
      Object.keys(profileToSave).forEach(keyStr => {
        const key = keyStr as keyof Partial<CompanyProfile>;
        if (profileToSave[key] === undefined) {
          delete profileToSave[key];
        }
      });
      
      await this.companyProfileService.saveCompanyProfile(profileToSave as CompanyProfile);
      await this.showToast('Perfil da empresa salvo com sucesso!', 'success');
      this.loadCompanyProfile(); // Reload to update displayed data
    } catch (error) {
      console.error('Erro ao salvar perfil da empresa:', error);
      await this.showToast('Erro ao salvar perfil da empresa.', 'danger');
    }
  }

  loadUsers() {
    this.users = this.storageService.getUsers();
  }

  openAddUserModal() {
    this.editingUser = null;
    this.newUser = {
      email: '',
      displayName: '',
      role: 'user'
    };
    this.showUserModal = true;
  }

  openEditUserModal(user: User) {
    this.editingUser = user;
    this.newUser = {
      email: user.email, // Use email
      // password: '', // Password is not directly stored in User model
      displayName: user.displayName, // Use displayName
      role: user.role
    };
    this.showUserModal = true;
  }

  async saveUser() {
    if (!this.newUser.email || !this.newUser.displayName) { // Changed validation
      await this.showToast('Preencha todos os campos obrigatórios', 'warning');
      return;
    }

    // TenantId is essential for multi-tenancy. We need it from the current authenticated user.
    const currentUserAuth = await firstValueFrom(this.authService.currentUser$);
    if (!currentUserAuth?.tenantId) {
      await this.showToast('Tenant ID não encontrado para o usuário atual.', 'danger');
      return;
    }
    const tenantId = currentUserAuth.tenantId;

    if (this.editingUser) {
      // Editar usuário existente
      // Password handling removed for now, as it's not part of User model for Firebase Auth direct management
      this.storageService.updateUser(this.editingUser.id, {
        tenantId: tenantId, // Ensure tenantId is passed for update
        email: this.newUser.email!, // Use email
        displayName: this.newUser.displayName!, // Use displayName
        role: this.newUser.role!
      });
      await this.showToast('Usuário atualizado com sucesso', 'success');
    } else {
      // Criar novo usuário
      // Password handling is for AuthService.register, not direct User model
      // For now, create user profile in Firestore directly. A proper user registration flow would use AuthService.register.
      // This part needs careful design for multi-tenancy user creation.
      const userToSave: User = {
        id: this.generateId(), // Temporary ID, would be Firebase Auth UID
        tenantId: tenantId,
        email: this.newUser.email!,
        displayName: this.newUser.displayName!,
        role: this.newUser.role!,
        createdAt: new Date().toISOString()
      };

      // Verificar se usuário já existe
      const existingUser = this.users.find(u => u.email === userToSave.email); // Check by email
      if (existingUser) {
        await this.showToast('Este usuário já existe', 'danger');
        return;
      }

      this.storageService.addUser(userToSave); // For now, use local storage
      await this.showToast('Usuário criado com sucesso', 'success');
    }

    this.loadUsers();
    this.showUserModal = false;
  }

  async deleteUser(user: User) {
    // Não permitir deletar a si mesmo
    if (user.email === this.currentUser?.email) { // Compare with Firebase email
      await this.showToast('Você não pode excluir seu próprio usuário autenticado', 'warning');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Confirmar exclusão',
      message: `Deseja realmente excluir o usuário "${user.displayName}"?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Excluir',
          role: 'destructive',
          handler: () => {
            this.storageService.deleteUser(user.id);
            this.loadUsers();
            this.showToast('Usuário excluído com sucesso', 'success');
          }
        }
      ]
    });
    await alert.present();
  }

  logout() {
    this.authService.logout();
  }

  getRoleLabel(role: string): string {
    return role === 'admin' ? 'Administrador' : 'Usuário';
  }

  getRoleColor(role: string): string {
    return role === 'admin' ? 'primary' : 'medium';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('pt-BR');
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'top'
    });
    await toast.present();
  }
}
