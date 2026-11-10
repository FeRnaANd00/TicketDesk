import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { auth, db } from './core/firebase.config';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Protege las rutas basándose en los roles permitidos declarados en la
 * configuración de navegación. Los roles desconocidos se tratan como user.
 */
export const roleGuard: CanActivateFn = async (route) => {
  const router = inject(Router);

  try {
    // Espera la restauración de Firebase para leer el rol de la sesión vigente.
    await auth.authStateReady();
    const user = auth.currentUser;

    if (!user) {
      return router.createUrlTree(['/login']);
    }

    // Los roles se obtienen del perfil asociado al usuario autenticado.
    const userDoc = await getDoc(doc(db, 'users', user.uid));

    if (!userDoc.exists()) {
      return router.createUrlTree(['/complete-profile']);
    }

    const role = userDoc.data()['role'] === 'admin' ? 'admin' : 'user';
    const configuredRoles = route.data?.['roles'];
    const requiredRoles = Array.isArray(configuredRoles)
      ? configuredRoles.filter((value): value is string => typeof value === 'string')
      : route.data?.['role']
        ? [route.data['role']]
        : [];

    if (requiredRoles.length === 0 || requiredRoles.includes(role)) {
      return true;
    }

    // Usuarios normales regresan a sus tickets; administradores al Dashboard.
    return router.createUrlTree([role === 'admin' ? '/dashboard' : '/tickets']);
  } catch (error) {
    console.error('Error verificando el rol del usuario:', error);
    return router.createUrlTree(['/login']);
  }
};
