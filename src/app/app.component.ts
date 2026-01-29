import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [
    RouterModule
  ],
})
export class AppComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private swUpdate = inject(SwUpdate);


  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      console.log('AppComponent: currentUser$ subscription - user:', user);
      if (!user) {
        console.log('AppComponent: User is null, navigating to /login.');
        this.router.navigate(['/login']);
      } else {
        console.log('AppComponent: User is authenticated, current user ID:', user.id);
      }
    });

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
