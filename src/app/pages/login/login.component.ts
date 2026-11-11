import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { auth, setAuthPersistence } from '../../core/firebase.config';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';

/**
 * Componente de Login.
 * Gestiona la autenticación del usuario mediante dos métodos:
 * 1. Credenciales tradicionales (Correo y Contraseña).
 * 2. Proveedor externo (Google Auth).
 * 
 * Redirige al usuario al panel principal tras un acceso exitoso, 
 * confiando en el ProfileGuard para la validación de datos personales.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  /** Correo electrónico ingresado por el usuario. */
  email = '';
  /** Contraseña ingresada por el usuario. */
  password = '';
  /** Indica si el acceso con correo y contraseña está en curso. */
  isLoading = false;
  /** Indica si el proceso de autenticación con Google está en curso. */
  isGoogleLoading = false;

  /** Recibe el router para navegar al panel después de autenticar al usuario. */
  constructor(private router: Router) {}

  /**
   * Inicia sesión utilizando el método tradicional de correo y contraseña.
   * Valida campos vacíos y gestiona la respuesta de Firebase Auth.
   */
  async onLogin() {
    if (this.isGoogleLoading) return;

    if (!this.email || !this.password) {
      alert('Por favor, ingresa correo y contraseña');
      return;
    }

    this.isLoading = true;
    try {
      await setAuthPersistence();
      await signInWithEmailAndPassword(auth, this.email.trim(), this.password);
      this.router.navigate(['/dashboard']); 
    } catch (error: any) {
      console.error('Error de login:', error.code);
      switch (error.code) {
        case 'auth/invalid-credential':
          alert('Credenciales incorrectas.'); break;
        case 'auth/user-not-found':
          alert('No existe una cuenta con ese correo.'); break;
        case 'auth/too-many-requests':
          alert('Demasiados intentos. Intenta más tarde.'); break;
        default:
          alert('Error al iniciar sesión. Verifica tu conexión.');
      }
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Mantiene el popup de Google en PC. En teléfonos también usa popup,
   * iniciándolo antes de cualquier operación asíncrona para conservar el gesto
   * del usuario que algunos navegadores móviles exigen para abrirlo.
   */
  async loginWithGoogle() {
    if (this.isLoading || this.isGoogleLoading) return;

    this.isGoogleLoading = true;
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);

      try {
        await setAuthPersistence();
      } catch (persistenceError) {
        console.error('No se pudo establecer la persistencia local:', persistenceError);
        alert('Se inició sesión, pero no se pudo mantener la sesión en este navegador.');
      }

      await this.router.navigate(['/dashboard']);
    } catch (error: any) {
      console.error('Error con Google Auth:', error.code);
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
        alert('El navegador bloqueó la ventana de Google. Permite ventanas emergentes e inténtalo de nuevo.');
      } else {
        alert('Hubo un problema al iniciar sesión con Google. Inténtalo de nuevo.');
      }
    } finally {
      this.isGoogleLoading = false;
    }
  }

  /** Controla la visibilidad del texto de la contraseña. */
  showPassword = false;

  /** Alterna entre mostrar u ocultar la contraseña en el campo de entrada. */
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }
}
