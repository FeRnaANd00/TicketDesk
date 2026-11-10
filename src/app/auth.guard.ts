import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { auth } from './core/firebase.config';

/**
 * AuthGuard funcional.
 * Protege las rutas verificando si hay un usuario autenticado en Firebase.
 * Si no hay usuario, redirige automáticamente a la pantalla de /login.
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const router = inject(Router);

  // Espera la restauración inicial de Firebase para no rechazar el retorno de Google.
  await auth.authStateReady();

  if (auth.currentUser) {
    // El usuario está autenticado; permitir el acceso a la ruta protegida.
    return true;
  }

  // El usuario no está autenticado; devolver una redirección controlada al login.
  return router.createUrlTree(['/login']);
};
