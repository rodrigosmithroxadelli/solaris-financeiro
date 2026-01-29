import { Injectable, inject, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { LoginCredentials, User } from '../models/user.model';
import { auth } from './firebase-config';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
  onAuthStateChanged
} from 'firebase/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { Observable, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private router = inject(Router);
  private firestore = inject(Firestore);
  private ngZone = inject(NgZone);
  private USERS_COLLECTION = 'users';

  private userSubject = new BehaviorSubject<User | null>(null);
  currentUser$: Observable<User | null> = this.userSubject.asObservable();

  constructor() {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const user = await this.getCustomUserProfile(firebaseUser);
        // Garante que o estado e a navegação ocorram dentro da zona do Angular
        this.ngZone.run(() => {
          this.userSubject.next(user);
          if (this.router.url === '/login') {
            console.log('AuthService: User authenticated, navigating to /app/inicio');
            this.router.navigate(['/app/inicio']);
          }
        });
      } else {
        // Garante que o estado e a navegação ocorram dentro da zona do Angular
        this.ngZone.run(() => {
          this.userSubject.next(null);
          if (this.router.url !== '/login') {
             console.log('AuthService: User logged out, navigating to /login');
             this.router.navigate(['/login']);
          }
        });
      }
    });
  }

  private async getCustomUserProfile(firebaseUser: FirebaseUser): Promise<User | null> {
    const userDocRef = doc(this.firestore, this.USERS_COLLECTION, firebaseUser.uid);
    try {
      const userDocSnap = await getDoc(userDocRef);
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
      // O listener onAuthStateChanged cuidará da navegação e atualização do estado.
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
