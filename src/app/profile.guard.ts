import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { auth, db } from './core/firebase.config';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

/**
 * =============================================================================
 * GUARDIA DE PERFIL: ProfileGuard (Versión con Persistencia de Sesión)
 * =============================================================================
 * Ubicación: src/app/profile.guard.ts
 * 
 * Esta guardia es la encargada de asegurar que el usuario esté autenticado 
 * y que su perfil esté completado antes de acceder a rutas protegidas.
 * 
 * PROBLEMA SOLUCIONADO: "El salto al Login al recargar".
 * Al recargar la página, Firebase tarda unos milisegundos en restaurar la sesión.
 * Esta versión implementa una espera activa mediante 'onAuthStateChanged' para 
 * evitar redirecciones falsas cuando el usuario sí está logueado.
 */

/**
 * CONFIGURACIÓN DE EMERGENCIA (DEBUG)
 * -----------------------------------
 * BYPASS_PROFILE_CHECK: Cuando es TRUE, la guardia permite el acceso directo.
 * Útil para pruebas rápidas de interfaz sin depender de la base de datos.
 */
const BYPASS_PROFILE_CHECK = true;

export const profileGuard: CanActivateFn = async (route, state) => {
  const router = inject(Router);

  /**
   * FUNCIÓN AUXILIAR: waitForAuth
   * ---------------------------
   * Envuelve el observador 'onAuthStateChanged' de Firebase en una Promesa.
   * Esto obliga a la Guardia a detenerse y esperar hasta que Firebase confirme 
   * si hay un usuario autenticado o no, eliminando el problema de la recarga de página.
   */
  const waitForAuth = (): Promise<any> => {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, (user) => {
        resolve(user);
      });
    });
  };

  try {
    // 1. ESPERA ACTIVA: Aguardamos a que Firebase restaure la sesión del navegador
    const user = await waitForAuth();

    // 2. Validación de Autenticación
    if (!user) {
      console.warn('⚠️ [ProfileGuard] No se detectó sesión activa. Redirigiendo al Login.');
      router.navigate(['/login']);
      return false;
    }

    // 3. Modo de Bypass para Desarrollo
    if (BYPASS_PROFILE_CHECK) {
      console.log('🛡️ [ProfileGuard] MODO SEGURO ACTIVO: Acceso concedido sin verificar perfil.');
      return true; 
    }

    // 4. Verificación de Perfil en Firestore
    // Una vez confirmado que el usuario existe, verificamos que tenga sus datos completos.
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (userDoc.exists()) {
      // Perfil completado -> Acceso permitido
      return true;
    } else {
      // Usuario autenticado pero sin datos -> Redirigir a completar perfil
      console.warn('⚠️ [ProfileGuard] Usuario sin perfil. Redirigiendo a /complete-profile.');
      router.navigate(['/complete-profile']);
      return false;
    }
  } catch (error) {
    /**
     * Manejo de errores críticos de conexión.
     * En caso de fallo total, se redirige al login por seguridad.
     */
    console.error('❌ [ProfileGuard] Error crítico durante la validación:', error);
    router.navigate(['/login']);
    return false;
  }
};