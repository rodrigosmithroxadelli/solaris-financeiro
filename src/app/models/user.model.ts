export interface User {
  id: string; // Firebase Auth UID
  tenantId: string; // ID do tenant ao qual o usuário pertence
  email: string;
  displayName?: string;
  photoURL?: string | null;
  role: 'admin' | 'user'; // Adicionado para controle de acesso
  createdAt: string; // Firestore Timestamp ou Date string
}

export interface LoginCredentials {
  email: string;
  password: string;
}
