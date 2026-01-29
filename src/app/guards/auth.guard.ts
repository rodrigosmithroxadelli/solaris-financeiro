import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    map(user => {
      if (user) {
        return true;
      } else {
        router.navigate(['/login']);
        return false;
      }
    })
  );
};

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.currentUser$.pipe(
    map(user => {
      if (user && user.role === 'admin') { // Check if user exists and has 'admin' role
        return true;
      } else if (user) {
        // User is authenticated but not an admin, redirect to home or show access denied
        console.warn('Access denied: User is not an admin.');
        router.navigate(['/os']); // Redirect to a safe authenticated page
        return false;
      } else {
        // User is not authenticated, redirect to login
        router.navigate(['/login']);
        return false;
      }
    })
  );
};
