import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { auth, db } from './core/firebase.config';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Protege el Dashboard: espera la sesión de Firebase y comprueba que el usuario
 * tenga nombre, departamento y teléfono guardados en Firestore. Si faltan datos,
 * dirige al formulario de completar perfil.
 */
export const profileGuard: CanActivateFn = async () => {
  // Obtiene el Router desde el contexto de ejecución de la guarda.
  const router = inject(Router);

  try {
    // Espera a que Firebase restaure la sesión antes de consultar al usuario actual.
    await auth.authStateReady();
    const user = auth.currentUser;

    // Sin usuario autenticado, bloquea el Dashboard y devuelve una URL de login.
    if (!user) {
      console.warn('⚠️ [ProfileGuard] No se detectó sesión activa. Redirigiendo al Login.');
      return router.createUrlTree(['/login']);
    }

    // Recupera el documento del usuario y verifica que existan los tres campos requeridos.
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const profile = userDoc.data();
    const hasRequiredProfile = userDoc.exists() &&
      ['username', 'department', 'phone'].every((field) => {
        const value = profile?.[field];
        return typeof value === 'string' && value.trim().length > 0;
      });

    if (hasRequiredProfile) {
      // Solo los perfiles con todos los campos requeridos permiten llegar al Dashboard.
      return true;
    }

    // Si el documento o algún campo requerido falta, redirige al formulario inicial.
    console.info('ℹ️ [ProfileGuard] Perfil pendiente. Redirigiendo a /complete-profile.');
    return router.createUrlTree(['/complete-profile']);
  } catch (error) {
    /**
     * Ante un fallo de Firebase, registra el error y evita conceder acceso al
     * Dashboard sin haber podido verificar el estado del perfil.
     */
    console.error('❌ [ProfileGuard] Error crítico durante la validación:', error);
    return router.createUrlTree(['/login']);
  }
};