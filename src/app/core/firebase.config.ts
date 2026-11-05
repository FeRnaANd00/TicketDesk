import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
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
 * Se utiliza 'initializeFirestore' en lugar de 'getFirestore' para poder pasar
 * un objeto de configuración. 
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
 * EXPORTACIONES
 * Se exportan las instancias ya configuradas para garantizar que toda la App
 * utilice la misma conexión (Singleton), optimizando el uso de memoria y red.
 */
export { app, db, auth };