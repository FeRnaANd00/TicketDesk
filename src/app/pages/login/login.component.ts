import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { auth } from '../../core/firebase.config';
import { signInWithEmailAndPassword } from 'firebase/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email = '';
  password = '';
  rememberMe = false;
  isLoading = false;

  constructor(private router: Router) {}

  async onLogin() {
    if (!this.email || !this.password) {
      alert('Por favor, ingresa correo y contraseña');
      return;
    }

    this.isLoading = true;
    try {
      await signInWithEmailAndPassword(auth, this.email, this.password);
      alert('¡Bienvenido a TicketDesk!');
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

  showPassword = false;
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }
}