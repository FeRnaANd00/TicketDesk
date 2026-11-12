import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { auth } from './core/firebase.config';

const AUTH_READY_TIMEOUT_MS = 15_000;

/** Prevents a stalled Firebase session restoration from blocking navigation. */
async function waitForAuthReady(): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('Firebase Auth tardó demasiado en restaurar la sesión.')),
      AUTH_READY_TIMEOUT_MS
    );
  });

  try {
    await Promise.race([auth.authStateReady(), timeout]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * AuthGuard funcional.
 * Protege las rutas verificando si hay un usuario autenticado en Firebase.
 * Si no hay usuario, redirige automáticamente a la pantalla de /login.
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const router = inject(Router);

  // Espera la restauración inicial de Firebase para no rechazar el retorno de Google.
  try {
    await waitForAuthReady();
  } catch (error) {
    console.error('❌ [AuthGuard] No se pudo restaurar la sesión a tiempo:', error);
    return router.createUrlTree(['/login']);
  }

  if (auth.currentUser) {
    // El usuario está autenticado; permitir el acceso a la ruta protegida.
    return true;
  }

  // El usuario no está autenticado; devolver una redirección controlada al login.
  return router.createUrlTree(['/login']);
};
