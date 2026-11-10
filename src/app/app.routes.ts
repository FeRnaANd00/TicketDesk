import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { CompleteProfileComponent } from './pages/complete-profile/complete-profile.component';
import { AdminComponent } from './pages/admin/admin.component';
import { AppShellComponent } from './layouts/app-shell/app-shell.component';
import { SectionPlaceholderComponent } from './pages/section-placeholder/section-placeholder.component';
import { authGuard } from './auth.guard';
import { profileGuard } from './profile.guard';
import { roleGuard } from './role.guard';

/**
 * Definición de las rutas de navegación de la aplicación TicketDesk.
 * Este archivo controla qué componente se carga según la URL ingresada en el navegador.
 */
export const routes: Routes = [
  { 
    // Ruta raíz: Redirige automáticamente al login para asegurar el acceso.
    path: '', 
    component: LoginComponent, 
    title: 'TicketDesk - Acceso' 
  },
  { 
    // Ruta explícita de login.
    path: 'login', 
    component: LoginComponent 
  },
  { 
    // Ruta de registro para nuevos agentes.
    path: 'register', 
    component: RegisterComponent,
    title: 'TicketDesk - Registro'
  },
  { 
    // Ruta para completar el perfil la primera vez.
    // Solo requiere estar autenticado (authGuard).
    path: 'complete-profile', 
    component: CompleteProfileComponent, 
    canActivate: [authGuard],
    title: 'TicketDesk - Completar Perfil'
  },
  { 
    // Ruta del Panel Principal.
    // El layout padre protege las secciones y proporciona la navegación compartida.
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard, profileGuard],
    children: [
      {
        // El Dashboard está reservado para cuentas administradoras.
        path: 'dashboard',
        component: DashboardComponent,
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        title: 'TicketDesk - Dashboard'
      },
      {
        // Destino temporal del menú hasta implementar el listado de tickets.
        path: 'tickets',
        component: SectionPlaceholderComponent,
        data: {
          title: 'Tickets',
          description: 'El listado y la gestión de tickets se implementarán a continuación.'
        },
        title: 'TicketDesk - Tickets'
      },
      {
        // Destino temporal del menú hasta implementar la edición del perfil.
        path: 'profile',
        component: SectionPlaceholderComponent,
        data: {
          title: 'Perfil',
          description: 'La consulta y edición del perfil se implementarán a continuación.'
        },
        title: 'TicketDesk - Perfil'
      },
      {
        // Destino temporal del menú hasta implementar la creación de tickets.
        path: 'new-ticket',
        component: SectionPlaceholderComponent,
        data: {
          title: 'Nuevo Ticket',
          description: 'El formulario para registrar incidencias se implementará a continuación.'
        },
        title: 'TicketDesk - Nuevo Ticket'
      },
      {
        // La gestión de Usuarios solo está disponible para administradores.
        path: 'users',
        component: AdminComponent,
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        title: 'TicketDesk - Usuarios'
      },
      {
        // Conserva los enlaces existentes que apuntan a la URL administrativa anterior.
        path: 'admin',
        redirectTo: 'users',
        pathMatch: 'full',
        title: 'TicketDesk - Usuarios'
      }
    ]
  },
  { 
    // Comodín (Wildcard): Captura cualquier ruta no definida anteriormente y redirige al inicio.
    path: '**', 
    redirectTo: '' 
  }
];
