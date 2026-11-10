import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { environment } from '../../environments/environment';

/**
 * =============================================================================
 * CONFIGURACIÓN CENTRAL DE FIREBASE - TICKETDESK
 * =============================================================================
 * Este módulo es el corazón de la comunicación con Google Cloud. 
 * Se encarga de instanciar los servicios de Base de Datos (Firestore) y 
 * Autenticación (Auth) para ser consumidos en toda la aplicación.
 */

/**
 * Inicialización de la aplicación de Firebase.
 * Se utilizan las credenciales definidas en el archivo de environment para
 * asegurar que la aplicación se conecte al proyecto correcto según el entorno.
 */
const app = initializeApp(environment.firebase);

/**
 * Configuración Avanzada de Firestore.
 * 
 * OPCIÓN: experimentalForceLongPolling
 * ------------------------------------
 * Esta opción es CRÍTICA para entornos corporativos. Fuerza a Firebase a usar
 * peticiones HTTP simples (Long Polling) en lugar de WebSockets/gRPC. 
 * Esto evita el error 'ERR_BLOCKED_BY_CLIENT' causado por Firewalls que bloquean
 * los canales de escucha persistentes.
 */
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

/**
 * Inicialización del servicio de Autenticación.
 * Gestiona el ciclo de vida de la sesión del usuario, el login con Google
 * y la persistencia de la identidad en el navegador.
 */
const auth = getAuth(app);

/**
 * Inicializa Firebase Storage para conservar archivos adjuntos fuera de
 * Firestore y almacenar en los tickets solamente sus metadatos y rutas.
 */
const storage = getStorage(app);

/**
 * Configura Firebase Auth para conservar la sesión en este navegador hasta que
 * el usuario cierre sesión o borre los datos del navegador.
 */
export async function setAuthPersistence() {
  try {
    await setPersistence(auth, browserLocalPersistence);
    console.log('✅ [Firebase] Persistencia local de sesión establecida.');
  } catch (error) {
    console.error('❌ [Firebase] Error al establecer persistencia de sesión:', error);
    throw error;
  }
}

/**
 * EXPORTACIONES
 * Se exportan las instancias ya configuradas para garantizar que toda la App
 * utilice la misma conexión (Singleton), optimizando el uso de memoria y red.
 */
export { app, db, auth, storage };