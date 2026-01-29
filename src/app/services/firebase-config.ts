import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { environment } from 'src/environments/environment'; // Import environment

const firebaseConfig = {
  apiKey: environment.firebaseConfig.apiKey,
  authDomain: environment.firebaseConfig.authDomain,
  projectId: environment.firebaseConfig.projectId,
  storageBucket: environment.firebaseConfig.storageBucket,
  messagingSenderId: environment.firebaseConfig.messagingSenderId,
  appId: environment.firebaseConfig.appId,
  // measurementId: environment.firebaseConfig.measurementId // Se tiver o Google Analytics configurado
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Obtém o serviço de autenticação
export const auth = getAuth(app);