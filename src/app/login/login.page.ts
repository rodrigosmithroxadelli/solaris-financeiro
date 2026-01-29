import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  ToastController, IonFooter, IonToolbar } from '@ionic/angular/standalone';
import { AuthService } from '../services/auth.service';
import { addIcons } from 'ionicons';
import { mailOutline, lockClosedOutline } from 'ionicons/icons'; // Updated icons

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonToolbar, IonFooter, 
    FormsModule,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonIcon
  ]
})
export class LoginPage {
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastController = inject(ToastController);

  email: string = '';
  password: string = '';
  isLoading: boolean = false;

  constructor() {
    addIcons({ mailOutline, lockClosedOutline }); // Updated icons
  }

  async login() {
    if (!this.email || !this.password) {
      await this.showToast('Por favor, preencha todos os campos', 'warning');
      return;
    }

    this.isLoading = true;

    try {
      await this.authService.login({ email: this.email, password: this.password });
      await this.showToast('Login realizado com sucesso!', 'success');
      // Navigation is now handled by AuthService's onAuthStateChanged

    } catch (error: any) {
      console.error('Login error:', error);
      await this.showToast(`Erro ao fazer login: ${error.message}`, 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async register() {
    if (!this.email || !this.password) {
      await this.showToast('Por favor, preencha todos os campos', 'warning');
      return;
    }

    this.isLoading = true;

    try {
      await this.authService.register({ email: this.email, password: this.password });
      await this.showToast('Registro realizado com sucesso! Faça login.', 'success');
      // Optionally, log in the user directly after registration
      // await this.authService.login({ email: this.email, password: this.password });
      // this.router.navigate(['/tabs/home']);
    } catch (error: any) {
      console.error('Registration error:', error);
      await this.showToast(`Erro ao registrar: ${error.message}`, 'danger');
    } finally {
      this.isLoading = false;
    }
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

