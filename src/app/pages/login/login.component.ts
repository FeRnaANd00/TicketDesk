import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { auth } from '../../core/firebase.config';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

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
  /** Estado del checkbox 'Recordarme'. */
  rememberMe = false;
  /** Indica si cualquier proceso de autenticación está en curso. */
  isLoading = false;

  constructor(private router: Router) {}

  /**
   * Inicia sesión utilizando el método tradicional de correo y contraseña.
   * Valida campos vacíos y gestiona la respuesta de Firebase Auth.
   */
  async onLogin() {
    if (!this.email || !this.password) {
      alert('Por favor, ingresa correo y contraseña');
      return;
    }

    this.isLoading = true;
    try {
      await signInWithEmailAndPassword(auth, this.email, this.password);
      this.router.navigate(['/dashboard']); 
    } catch (error: any) {
      console.error('Error de login:', error.code);
      switch (error.code) {
        case 'auth/invalid-credential':
          alert('Credenciales incorrectas.'); break;
        default:
          alert('Error al iniciar sesión. Verifica tu conexión.');
      }
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Inicia sesión utilizando el proveedor de Google.
   * Abre una ventana emergente de Google y, tras la autorización,
   * redirige al usuario al Dashboard.
   */
  async loginWithGoogle() {
    this.isLoading = true;
    try {
      // Configuración del proveedor de Google
      const provider = new GoogleAuthProvider();
      
      // Apertura de popup de autenticación de Google
      await signInWithPopup(auth, provider);
      
      // Redirección al dashboard (el profileGuard verificará si debe ir a completar perfil)
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      console.error('Error con Google Auth:', error.code);
      alert('Hubo un problema al iniciar sesión con Google. Inténtalo de nuevo.');
    } finally {
      this.isLoading = false;
    }
  }

  /** Controla la visibilidad del texto de la contraseña. */
  showPassword = false;

  /** Alterna entre mostrar u ocultar la contraseña en el campo de entrada. */
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }
}
