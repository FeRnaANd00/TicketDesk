import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { auth } from './core/firebase.config';
import { onAuthStateChanged } from 'firebase/auth';

/**
 * AuthGuard funcional.
 * Protege las rutas verificando si hay un usuario autenticado en Firebase.
 * Si no hay usuario, redirige automáticamente a la pantalla de /login.
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const router = inject(Router);

  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // El usuario está autenticado, permitir acceso
        resolve(true);
      } else {
        // El usuario no está autenticado, redirigir al login
        router.navigate(['/login']);
        resolve(false);
      }
    });
  });
};
