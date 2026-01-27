import { Component, OnInit } from '@angular/core';
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
import { addIcons } from 'ionicons';
import { personAdd, create, trash, logOut, shieldCheckmark, person, lockClosed } from 'ionicons/icons';

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
  users: User[] = [];
  currentUser: User | null = null;
  isAdmin: boolean = false;
  
  // Modal de novo/editar usuário
  showUserModal: boolean = false;
  editingUser: User | null = null;
  newUser: Partial<User> = {
    username: '',
    password: '',
    name: '',
    role: 'user'
  };

  constructor(
    private authService: AuthService,
    private storageService: StorageService,
    private router: Router,
    private alertController: AlertController,
    private toastController: ToastController
  ) {
    addIcons({ personAdd, create, trash, logOut, shieldCheckmark, person, lockClosed });
  }

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    this.isAdmin = this.authService.isAdmin();
    this.loadUsers();
  }

  loadUsers() {
    this.users = this.storageService.getUsers();
  }

  openAddUserModal() {
    this.editingUser = null;
    this.newUser = {
      username: '',
      password: '',
      name: '',
      role: 'user'
    };
    this.showUserModal = true;
  }

  openEditUserModal(user: User) {
    this.editingUser = user;
    this.newUser = {
      username: user.username,
      password: '', // Não mostrar senha
      name: user.name,
      role: user.role
    };
    this.showUserModal = true;
  }

  async saveUser() {
    if (!this.newUser.username || !this.newUser.name) {
      await this.showToast('Preencha todos os campos obrigatórios', 'warning');
      return;
    }

    if (this.editingUser) {
      // Editar usuário existente
      if (!this.newUser.password) {
        // Se não informou nova senha, manter a antiga
        const oldUser = this.storageService.getUsers().find(u => u.id === this.editingUser!.id);
        if (oldUser) {
          this.newUser.password = oldUser.password;
        }
      }
      this.storageService.updateUser(this.editingUser.id, {
        username: this.newUser.username!,
        password: this.newUser.password!,
        name: this.newUser.name!,
        role: this.newUser.role!
      });
      await this.showToast('Usuário atualizado com sucesso', 'success');
    } else {
      // Criar novo usuário
      if (!this.newUser.password) {
        await this.showToast('A senha é obrigatória para novos usuários', 'warning');
        return;
      }

      const user: User = {
        id: this.generateId(),
        username: this.newUser.username!,
        password: this.newUser.password!,
        name: this.newUser.name!,
        role: this.newUser.role!,
        createdAt: new Date().toISOString()
      };

      // Verificar se usuário já existe
      const existingUser = this.users.find(u => u.username === user.username);
      if (existingUser) {
        await this.showToast('Este usuário já existe', 'danger');
        return;
      }

      this.storageService.addUser(user);
      await this.showToast('Usuário criado com sucesso', 'success');
    }

    this.loadUsers();
    this.showUserModal = false;
  }

  async deleteUser(user: User) {
    // Não permitir deletar a si mesmo
    if (user.id === this.currentUser?.id) {
      await this.showToast('Você não pode excluir seu próprio usuário', 'warning');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Confirmar exclusão',
      message: `Deseja realmente excluir o usuário "${user.name}"?`,
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
