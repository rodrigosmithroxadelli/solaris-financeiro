import { Injectable, inject, NgZone, EnvironmentInjector, runInInjectionContext, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { LoginCredentials, User } from '../models/user.model';
import { auth } from './firebase-config';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { Observable, BehaviorSubject } from 'rxjs';
import { authState } from '@angular/fire/auth';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private router = inject(Router);
  private firestore = inject(Firestore);
  private ngZone = inject(NgZone);
  private environmentInjector = inject(EnvironmentInjector);
  private destroyRef = inject(DestroyRef);
  private USERS_COLLECTION = 'users';

  private userSubject = new BehaviorSubject<User | null>(null);
  private lastLoadedUserId: string | null = null;
  private loadingUserId: string | null = null;
  currentUser$: Observable<User | null> = this.userSubject.asObservable();

  constructor() {
    authState(auth)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async (firebaseUser) => {
      if (firebaseUser) {
        if (this.lastLoadedUserId === firebaseUser.uid || this.loadingUserId === firebaseUser.uid) {
          this.ngZone.run(() => {
            if (this.router.url === '/login') {
              console.log('AuthService: User authenticated, navigating to /app/inicio');
              this.router.navigate(['/app/inicio']);
            }
          });
          return;
        }
        this.loadingUserId = firebaseUser.uid;
        const user = await this.getCustomUserProfile(firebaseUser);
        this.loadingUserId = null;
        this.lastLoadedUserId = firebaseUser.uid;
        // Run state updates and navigation within Angular's zone
        this.ngZone.run(() => {
          this.userSubject.next(user);
          if (this.router.url === '/login') {
            console.log('AuthService: User authenticated, navigating to /app/inicio');
            this.router.navigate(['/app/inicio']);
          }
        });
      } else {
        this.loadingUserId = null;
        this.lastLoadedUserId = null;
        // Run state updates and navigation within Angular's zone
        this.ngZone.run(() => {
          this.userSubject.next(null);
          console.log('AuthService: User logged out, navigating to /login');
          this.router.navigate(['/login']);
        });
      }
    });
  }

  private async getCustomUserProfile(firebaseUser: FirebaseUser): Promise<User | null> {
    const userDocRef = runInInjectionContext(this.environmentInjector, () =>
      doc(this.firestore, this.USERS_COLLECTION, firebaseUser.uid)
    );
    try {
      const userDocSnap = await runInInjectionContext(this.environmentInjector, () =>
        getDoc(userDocRef)
      );
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const customUser: User = {
          id: firebaseUser.uid,
          tenantId: userData['tenantId'],
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || undefined,
          photoURL: firebaseUser.photoURL || undefined,
          role: userData['role'] || 'user',
          createdAt: userData['createdAt'] || new Date().toISOString()
        };
        console.log('AuthService: Custom user profile loaded:', customUser);
        return customUser;
      } else {
        console.error('AuthService: User profile document not found in Firestore.');
        return null;
      }
    } catch (error) {
      console.error('AuthService: Error fetching user profile:', error);
      return null;
    }
  }

  async register({ email, password }: LoginCredentials): Promise<FirebaseUser | null> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        await this.createUserProfile(userCredential.user, 'default_tenant', 'user');
      }
      return userCredential.user;
    } catch (error) {
      console.error('AuthService: Registration failed:', error);
      throw error;
    }
  }

  async login({ email, password }: LoginCredentials): Promise<FirebaseUser | null> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      console.error('AuthService: Login failed:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(auth);
      // The authState listener will handle navigation and state updates.
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  private async createUserProfile(firebaseUser: FirebaseUser, tenantId: string, role: 'admin' | 'user'): Promise<void> {
    const userDocRef = doc(this.firestore, this.USERS_COLLECTION, firebaseUser.uid);
    const userProfile: User = {
      id: firebaseUser.uid,
      tenantId: tenantId,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
      photoURL: firebaseUser.photoURL || null,
      role: role,
      createdAt: new Date().toISOString()
    };
    await setDoc(userDocRef, userProfile);
    console.log('User profile created in Firestore:', userProfile);
  }
}
