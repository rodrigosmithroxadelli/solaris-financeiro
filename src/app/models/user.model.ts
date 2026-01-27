export interface User {
  id: string;
  username: string;
  password: string; // Em produção, deve ser hash
  name: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}
