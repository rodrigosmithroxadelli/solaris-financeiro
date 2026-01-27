import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonIcon,
  ToastController
} from '@ionic/angular/standalone';
import { AuthService } from '../services/auth.service';
import { addIcons } from 'ionicons';
import { lockClosed, person } from 'ionicons/icons';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonIcon
  ]
})
export class LoginPage {
  username: string = '';
  password: string = '';
  isLoading: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastController: ToastController
  ) {
    addIcons({ lockClosed, person });
    
    // Se já estiver autenticado, redireciona
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/tabs/home']);
    }
  }

  async login() {
    if (!this.username || !this.password) {
      await this.showToast('Por favor, preencha todos os campos', 'warning');
      return;
    }

    this.isLoading = true;

    const success = this.authService.login({
      username: this.username,
      password: this.password
    });

    this.isLoading = false;

    if (success) {
      await this.showToast('Login realizado com sucesso!', 'success');
      this.router.navigate(['/tabs/home']);
    } else {
      await this.showToast('Usuário ou senha incorretos', 'danger');
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
