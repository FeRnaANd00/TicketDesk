import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { auth } from '../../core/firebase.config';
import { createUserWithEmailAndPassword } from 'firebase/auth';

/**
 * Componente de Registro de Usuario.
 * Permite a los nuevos agentes crear una cuenta de acceso en el sistema
 * interactuando con el módulo de Firebase Authentication.
 */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  /** Correo electrónico corporativo ingresado por el nuevo usuario. */
  email = '';
  /** Contraseña elegida por el usuario. */
  password = '';
  /** Campo de confirmación para validar que la contraseña se escribió correctamente. */
  confirmPassword = '';
  /** Estado de carga para deshabilitar el botón durante el proceso de creación en Firebase. */
  isLoading = false;

  constructor(private router: Router) {}

  /**
   * Procesa la creación de la cuenta de usuario.
   * Realiza validaciones locales (campos vacíos, coincidencia de contraseñas)
   * y posteriormente llama al SDK de Firebase para registrar el usuario.
   */
  async onRegister() {
    // Validación 1: Verificación de campos obligatorios
    if (!this.email || !this.password || !this.confirmPassword) {
      alert('Por favor, completa todos los campos');
      return;
    }

    // Validación 2: Coincidencia de contraseñas
    if (this.password !== this.confirmPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }

    this.isLoading = true;
    try {
      // Creación del usuario en Firebase Auth
      await createUserWithEmailAndPassword(auth, this.email, this.password);
      
      // Se elimina la alerta de éxito para evitar interrupciones en la experiencia del usuario.
      
      // Redirección obligatoria al formulario de datos personales (Onboarding)
      this.router.navigate(['/complete-profile']);
    } catch (error: any) {
      console.error('Error de registro:', error.code);
      
      // Mapeo de errores técnicos de Firebase a mensajes amigables en español
      switch (error.code) {
        case 'auth/email-already-in-use':
          alert('Este correo ya está registrado.'); break;
        case 'auth/invalid-email':
          alert('El formato del correo no es válido.'); break;
        case 'auth/weak-password':
          alert('La contraseña es demasiado débil.'); break;
        default:
          alert('Error al crear la cuenta. Inténtalo más tarde.');
      }
    } finally {
      this.isLoading = false;
    }
  }
}
