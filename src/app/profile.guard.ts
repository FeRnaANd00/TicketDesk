import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { auth, db } from './core/firebase.config';
import { doc, getDoc } from 'firebase/firestore';

/**
 * =============================================================================
 * GUARDIA DE PERFIL: ProfileGuard
 * =============================================================================
 * Ubicación: src/app/profile.guard.ts
 * 
 * El ProfileGuard es un middleware de seguridad que intercepta las rutas para 
 * asegurar que el usuario no solo esté autenticado, sino que también haya 
 * completado su registro obligatorio en la base de datos de Firestore.
 * 
 * Flujo de Validación:
 * 1. Verifica si hay un usuario autenticado en Firebase Auth.
 * 2. Consulta la colección 'users' en Firestore usando el UID del usuario.
 * 3. Si el documento existe, permite el acceso.
 * 4. Si no existe, redirige a '/complete-profile'.
 */

/**
 * CONFIGURACIÓN DE EMERGENCIA (DEBUG)
 * ----------------------------------
 * BYPASS_PROFILE_CHECK: Cuando es TRUE, la guardia ignora la verificación de Firestore
 * y permite el acceso directo. Se utiliza para mitigar errores de red como 
 * 'ERR_BLOCKED_BY_CLIENT' durante la fase de desarrollo en entornos restringidos.
 */
const BYPASS_PROFILE_CHECK = true;

export const profileGuard: CanActivateFn = async (route, state) => {
  const router = inject(Router);
  const user = auth.currentUser;

  // 1. Validación de Autenticación Básica
  if (!user) {
    console.warn('⚠️ [ProfileGuard] Intento de acceso sin usuario autenticado.');
    router.navigate(['/login']);
    return false;
  }

  // 2. Modo de Bypass para Desarrollo
  if (BYPASS_PROFILE_CHECK) {
    console.log('🛡️ [ProfileGuard] MODO SEGURO ACTIVO: Saltando verificación de Firestore.');
    return true; // Permite el acceso sin consultar la base de datos
  }

  try {
    // 3. Verificación de Perfil en Firestore
    // Consultamos si existe el documento del usuario en la colección 'users'
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (userDoc.exists()) {
      // El perfil está completo -> Permitir acceso
      return true;
    } else {
      // El perfil no existe -> Redirigir al formulario de completado
      console.warn('⚠️ [ProfileGuard] Usuario autenticado pero sin perfil completado.');
      router.navigate(['/complete-profile']);
      return false;
    }
  } catch (error) {
    /**
     * Manejo de errores de red (ej. ERR_BLOCKED_BY_CLIENT).
     * Si ocurre un error de conexión, redirigimos al login para evitar 
     * que la aplicación se quede en un estado indeterminado.
     */
    console.error('❌ [ProfileGuard] Error crítico al verificar el perfil:', error);
    router.navigate(['/login']);
    return false;
  }
};