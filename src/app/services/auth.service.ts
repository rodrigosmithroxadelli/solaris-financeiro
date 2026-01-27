import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from './storage.service';
import { User, LoginCredentials } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private currentUser: User | null = null;

  constructor(
    private storageService: StorageService,
    private router: Router
  ) {
    // Inicializa admin padrão se não existir
    this.storageService.initializeDefaultAdmin();
    
    // Restaura sessão se existir
    this.currentUser = this.storageService.getCurrentUser();
  }

  login(credentials: LoginCredentials): boolean {
    const users = this.storageService.getUsers();
    const user = users.find(
      u => u.username === credentials.username && u.password === credentials.password
    );

    if (user) {
      this.currentUser = user;
      this.storageService.setCurrentUser(user);
      return true;
    }

    return false;
  }

  logout(): void {
    this.currentUser = null;
    this.storageService.clearAll();
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  canManageUsers(): boolean {
    return this.isAdmin();
  }
}
