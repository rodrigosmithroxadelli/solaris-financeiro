import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LoginCredentials, User } from '../models/user.model';
import { auth } from './firebase-config';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { Firestore, doc, setDoc, docData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { authState } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private router = inject(Router);
  private firestore = inject(Firestore);
  private USERS_COLLECTION = 'users';

  currentUser$: Observable<User | null>;

  constructor() {
    // Use authState observable (proper AngularFire way)
    this.currentUser$ = authState(auth).pipe(
      switchMap(firebaseUser => {
        console.log('AuthService: authState changed - firebaseUser:', firebaseUser);
        if (firebaseUser) {
          const userDocRef = doc(this.firestore, this.USERS_COLLECTION, firebaseUser.uid);
          // Use docData to get real-time updates
          return docData(userDocRef).pipe(
            map(userData => {
              if (userData) {
                const customUser: User = {
                  id: firebaseUser.uid,
                  tenantId: userData['tenantId'] || 'default_tenant',
                  email: firebaseUser.email || '',
                  displayName: firebaseUser.displayName || undefined,
                  photoURL: firebaseUser.photoURL || undefined,
                  role: userData['role'] || 'user',
                  createdAt: userData['createdAt'] || new Date().toISOString()
                };
                console.log('AuthService: User loaded from Firestore:', customUser);
                
                // Navigate from login on successful auth
                if (this.router.url === '/login') {
                  this.router.navigate(['/app/inicio']);
                }
                
                return customUser;
              }
              return null;
            })
          );
        } else {
          console.log('AuthService: User logged out');
          // Navigate to login if logged out
          if (this.router.url !== '/login') {
            this.router.navigate(['/login']);
          }
          return new Observable<User | null>(observer => observer.next(null));
        }
      })
    );
  }

  async register({ email, password }: LoginCredentials): Promise<FirebaseUser | null> {
    console.log('AuthService: Attempting to register user with email:', email);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('AuthService: Firebase registration successful for email:', email);
      
      // Create user profile in Firestore
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
    console.log('AuthService: Attempting to log in user with email:', email);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('AuthService: Firebase login successful for email:', email);
      // authState will automatically trigger and load user profile
      return userCredential.user;
    } catch (error) {
      console.error('AuthService: Login failed:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(auth);
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  /**
   * Creates a user profile document in Firestore after successful Firebase Auth registration.
   */
  private async createUserProfile(
    firebaseUser: FirebaseUser,
    tenantId: string,
    role: 'admin' | 'user'
  ): Promise<void> {
    const userDocRef = doc(this.firestore, this.USERS_COLLECTION, firebaseUser.uid);
    const userProfile: User = {
      id: firebaseUser.uid,
      tenantId: tenantId,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
      photoURL: firebaseUser.photoURL || undefined,
      role: role,
      createdAt: new Date().toISOString()
    };
    await setDoc(userDocRef, userProfile);
    console.log('User profile created in Firestore:', userProfile);
  }
}
