import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { environment } from '../../environments/environment';

/**
 * Configuración central de Firebase para TicketDesk.
 * Instancia una sola vez Firestore y Authentication para toda la aplicación.
 */
const app = initializeApp(environment.firebase);

/**
 * Fuerza Long Polling (peticiones HTTP simples) en lugar de canales de escucha
 * persistentes. Es NECESARIO en redes corporativas, firewalls o bloqueadores que
 * cortan esos canales (ERR_BLOCKED_BY_CLIENT): sin esto la lectura del perfil
 * tras el login queda colgada y los guards devuelven al usuario al login.
 * No cambiar a experimentalAutoDetectLongPolling: la detección falla en esas redes.
 */
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

/** Gestiona la sesión del usuario, el login con Google y su persistencia. */
const auth = getAuth(app);

/**
 * Conserva la sesión en este navegador hasta que el usuario cierre sesión
 * o borre los datos del navegador.
 */
export async function setAuthPersistence(): Promise<void> {
  await setPersistence(auth, browserLocalPersistence);
}

export { app, db, auth };
