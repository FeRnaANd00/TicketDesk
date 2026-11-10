import { Component, EventEmitter, HostBinding, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

/** Roles existentes y válidos para la navegación de TicketDesk. */
type UserRole = 'admin' | 'technician' | 'user';

/**
 * Renderiza la navegación lateral común y emite cuando se selecciona una ruta
 * para que el contenedor pueda cerrar el menú móvil.
 */
@Component({
  selector: 'app-workspace-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './workspace-sidebar.component.html',
  styleUrl: './workspace-sidebar.component.css'
})
export class WorkspaceSidebarComponent {
  /** Controla si el panel lateral está abierto en una pantalla compacta. */
  @Input() isOpen = false;
  /** Rol cargado desde el perfil para decidir qué enlaces mostrar. */
  @Input() userRole: UserRole = 'user';
  /** Añade una clase al host para animar la barra lateral en móviles. */
  @HostBinding('class.workspace-sidebar-host-open')
  get isHostOpen(): boolean {
    return this.isOpen;
  }

  /** Notifica al contenedor que se eligió una sección o se cerró el fondo. */
  @Output() navigationSelected = new EventEmitter<void>();

  /** Catálogo de navegación y roles habilitados para cada sección. */
  readonly navigationItems: Array<{
    label: string;
    icon: string;
    route: string;
    exact: boolean;
    roles: UserRole[];
  }> = [
    { label: 'Dashboard', icon: 'space_dashboard', route: '/dashboard', exact: true, roles: ['admin', 'technician'] },
    { label: 'Tickets', icon: 'confirmation_number', route: '/tickets', exact: false, roles: ['admin', 'technician', 'user'] },
    { label: 'Perfil', icon: 'person', route: '/profile', exact: false, roles: ['admin', 'technician', 'user'] },
    { label: 'Nuevo Ticket', icon: 'add_circle', route: '/new-ticket', exact: false, roles: ['admin', 'technician', 'user'] },
    { label: 'Usuarios', icon: 'group', route: '/users', exact: false, roles: ['admin'] }
  ];

  /** Enlaces visibles para el rol actual, con usuarios como valor seguro inicial. */
  get visibleNavigationItems() {
    return this.navigationItems.filter((item) => item.roles.includes(this.userRole));
  }
}
