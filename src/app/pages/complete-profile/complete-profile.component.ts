import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { auth, db } from '../../core/firebase.config';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

/**
 * Componente para completar el perfil del usuario.
 * Se muestra la primera vez que un usuario se registra para recolectar
 * datos adicionales necesarios para el sistema (Nombre, Departamento, Teléfono).
 */
@Component({
  selector: 'app-complete-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './complete-profile.component.html',
  styleUrls: ['./complete-profile.component.css']
})
export class CompleteProfileComponent {
  /** Nombre de usuario que se mostrará en la plataforma. */
  username = '';
  /** Departamento al que pertenece el agente (ej. IT, RRHH, Contabilidad). */
  department = '';
  /** Número de contacto del usuario. */
  phone = '';
  /** Estado de carga para evitar múltiples envíos. */
  isLoading = false;

  constructor(private router: Router, private changeDetector: ChangeDetectorRef) {}

  /**
   * Guarda los datos adicionales del perfil en la colección 'users' de Firestore.
   * Utiliza el UID del usuario autenticado como ID del documento para asegurar la unicidad.
   */
  async onSaveProfile() {
    const username = this.username.trim();
    const department = this.department.trim();
    const phone = this.phone.trim();
    if (!username || !department || !phone) {
      alert('Por favor, completa todos los campos requeridos');
      return;
    }

    this.isLoading = true;
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No hay usuario autenticado');

      // Referencia al documento del usuario en la colección 'users'
      const userDocRef = doc(db, 'users', user.uid);

      // Guardamos los datos del perfil junto con el email, el UID y un rol por defecto.
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email ?? '',
        username,
        department,
        phone,
        role: 'user', // Asignamos rol de usuario por defecto a todo nuevo registro.
        profileCompleted: true,
        createdAt: serverTimestamp()
      });


      // Se elimina la alerta de éxito para un flujo de navegación más natural y profesional.
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      console.error('Error al guardar el perfil:', error);
      alert('Ocurrió un error al guardar tu perfil. Por favor, intenta de nuevo.');
    } finally {
      this.isLoading = false;
      this.changeDetector.markForCheck();
    }
  }
}
