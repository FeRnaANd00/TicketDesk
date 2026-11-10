import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { WorkspaceHeaderComponent } from '../workspace-header/workspace-header.component';
import { WorkspaceSidebarComponent } from '../workspace-sidebar/workspace-sidebar.component';

/**
 * Define un contenedor común para las páginas autenticadas de TicketDesk.
 * La barra lateral, búsqueda, identidad y cierre de sesión se comparten entre
 * Dashboard y las secciones que se implementarán a continuación.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterModule, WorkspaceHeaderComponent, WorkspaceSidebarComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css'
})
export class AppShellComponent {
  /** Controla la navegación lateral en pantallas pequeñas. */
  isMobileNavigationOpen = false;
  /** Rol del usuario autenticado, compartido con la navegación lateral. */
  userRole: 'admin' | 'user' = 'user';

  /** Cierra la navegación móvil tras seleccionar una ruta o el fondo oscuro. */
  closeMobileNavigation(): void {
    this.isMobileNavigationOpen = false;
  }

  /** Abre o cierra la navegación lateral móvil desde la barra superior. */
  toggleMobileNavigation(): void {
    this.isMobileNavigationOpen = !this.isMobileNavigationOpen;
  }

  /** Actualiza el rol recibido desde la carga del perfil en la barra superior. */
  updateUserRole(role: 'admin' | 'user'): void {
    this.userRole = role;
  }
}
