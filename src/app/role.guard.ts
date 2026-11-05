import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { auth, db } from './core/firebase.config';
import { doc, getDoc } from 'firebase/firestore';

/**
 * RoleGuard funcional.
 * Este guardia protege las rutas verificando si el usuario autenticado
 * posee el rol necesario para acceder a una sección específica.
 * 
 * El rol se consulta directamente en el documento del usuario en la colección 'users' de Firestore.
 */
export const roleGuard: CanActivateFn = async (route, state) => {
  const router = inject(Router);
  const user = auth.currentUser;

  if (!user) {
    // Si no hay usuario autenticado, redirigimos al login.
    router.navigate(['/login']);
    return false;
  }

  try {
    // Obtenemos el documento del usuario desde la colección 'users'
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (!userDoc.exists()) {
      // Si el perfil no existe, redirigimos a completar el perfil.
      router.navigate(['/complete-profile']);
      return false;
    }

    const userData = userDoc.data();
    // Acceso mediante corchetes para evitar el error TS4111 (index signature access).
    const userRole = userData?.['role'];

    // Obtenemos el rol requerido desde la configuración de la ruta en app.routes.ts
    const requiredRole = route.data?.['role'];

    // Si la ruta no requiere un rol específico, permitimos el acceso.
    if (!requiredRole) return true;

    // Verificamos si el rol del usuario coincide con el rol requerido.
    if (userRole === requiredRole) {
      return true;
    } else {
      // Si el usuario no tiene el rol necesario, lo redirigimos al dashboard.
      alert('No tienes permisos de administrador para acceder a esta sección.');
      router.navigate(['/dashboard']);
      return false;
    }
  } catch (error) {
    console.error('Error verificando el rol del usuario:', error);
    router.navigate(['/login']);
    return false;
  }
};
