import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../core/firebase.config';

/**
 * Proporciona la búsqueda y los controles de cuenta para todas las secciones
 * autenticadas, incluida la acción explícita de cerrar sesión en Firebase.
 */
@Component({
  selector: 'app-workspace-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workspace-header.component.html',
  styleUrl: './workspace-header.component.css'
})
export class WorkspaceHeaderComponent implements OnInit {
  /** Notifica al contenedor cuando se activa el botón de navegación móvil. */
  @Output() navigationToggle = new EventEmitter<void>();
  /** Comparte el rol normalizado del perfil con la navegación lateral. */
  @Output() accountRoleLoaded = new EventEmitter<'admin' | 'technician' | 'user'>();

  /** Identidad que se muestra en el encabezado y en el panel de cuenta. */
  accountName = 'Usuario';
  /** Correo de Firebase que se muestra en el panel de cuenta. */
  accountEmail = '';
  /** Rol de cuenta legible que se muestra en el encabezado y el panel. */
  accountRole = 'Usuario';
  /** Controla la visibilidad de la tarjeta personalizada de cuenta. */
  isAccountMenuOpen = false;
  /** Evita solicitudes duplicadas mientras se cierra la sesión. */
  isLoggingOut = false;

  /** Recibe el router para devolver al usuario a la pantalla de login. */
  constructor(private router: Router) {}

  /** Carga el usuario activo de Firebase y su perfil para el encabezado. */
  async ngOnInit(): Promise<void> {
    await this.loadAccount();
  }

  /**
   * Restaura la autenticación de Firebase y carga el perfil almacenado.
   * El nombre y el correo de Auth sirven como alternativa visible.
   */
  private async loadAccount(): Promise<void> {
    try {
      await auth.authStateReady();
      const user = auth.currentUser;

      if (!user) {
        return;
      }

      this.accountEmail = user.email ?? '';
      this.accountName = user.displayName?.trim()
        || this.accountEmail.split('@')[0]
        || 'Usuario';

      const profileSnapshot = await getDoc(doc(db, 'users', user.uid));
      if (!profileSnapshot.exists()) {
        return;
      }

      const profile = profileSnapshot.data();
      const username = profile['username'];
      if (typeof username === 'string' && username.trim()) {
        this.accountName = username.trim();
      }

      const storedRole = profile['role'];
      const role = storedRole === 'admin' || storedRole === 'technician'
        ? storedRole
        : 'user';
      this.accountRole = this.getRoleLabel(role);
      this.accountRoleLoaded.emit(role);
    } catch (error) {
      console.error('Error al cargar la identidad del usuario:', error);
    }
  }

  /** Convierte los identificadores de rol a las etiquetas de la interfaz. */
  private getRoleLabel(role: unknown): string {
    if (role === 'admin') {
      return 'Administrador';
    }

    return role === 'technician' ? 'Técnico' : 'Usuario';
  }

  /** Genera las iniciales del avatar usando las dos primeras palabras del nombre. */
  get accountInitials(): string {
    return this.accountName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  /** Abre o cierra la tarjeta personalizada de cuenta. */
  toggleAccountMenu(): void {
    this.isAccountMenuOpen = !this.isAccountMenuOpen;
  }

  /** Cierra la tarjeta al pulsar fuera de ella o presionar Escape. */
  closeAccountMenu(): void {
    this.isAccountMenuOpen = false;
  }

  /** Cierra la sesión de Firebase y navega a la página de login. */
  async logout(): Promise<void> {
    if (this.isLoggingOut) {
      return;
    }

    this.isLoggingOut = true;
    try {
      await signOut(auth);
      this.closeAccountMenu();
      await this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      alert('No se pudo cerrar la sesión. Inténtalo de nuevo.');
    } finally {
      this.isLoggingOut = false;
    }
  }
}
