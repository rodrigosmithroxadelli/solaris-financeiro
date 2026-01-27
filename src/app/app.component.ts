import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SwUpdate, VersionEvent, VersionReadyEvent } from '@angular/service-worker'; // Added SwUpdate, VersionEvent, VersionReadyEvent
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  constructor(
    private authService: AuthService,
    private router: Router,
    private swUpdate: SwUpdate // Injected SwUpdate
  ) {}

  ngOnInit() {
    // Verifica autenticação ao iniciar
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
    }

    // --- Service Worker Update Logic ---
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.subscribe((event: VersionEvent) => {
        if (event.type === 'VERSION_READY') {
          console.log('Nova versão do aplicativo disponível. Atualizando...');
          // Force activate and reload
          this.swUpdate.activateUpdate().then(() => document.location.reload());
        }
      });
    }
    // --- End Service Worker Update Logic ---
  }
}
