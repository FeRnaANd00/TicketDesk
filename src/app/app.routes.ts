import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { CompleteProfileComponent } from './pages/complete-profile/complete-profile.component';
import { AppShellComponent } from './layouts/app-shell/app-shell.component';
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
        // El Dashboard está disponible para administradores y técnicos.
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.component')
          .then((module) => module.DashboardComponent),
        canActivate: [roleGuard],
        data: { roles: ['admin', 'technician'] },
        title: 'TicketDesk - Dashboard'
      },
      {
        // Lista los tickets propios y la cola visible para administradores y técnicos.
        path: 'tickets',
        loadComponent: () => import('./pages/tickets/tickets.component')
          .then((module) => module.TicketsComponent),
        title: 'TicketDesk - Tickets'
      },
      {
        // Muestra la identidad y el resumen personal de tickets del usuario.
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.component')
          .then((module) => module.ProfileComponent),
        title: 'TicketDesk - Perfil'
      },
      {
        // Formulario para registrar una incidencia y sus archivos opcionales.
        path: 'new-ticket',
        loadComponent: () => import('./pages/new-ticket/new-ticket.component')
          .then((module) => module.NewTicketComponent),
        title: 'TicketDesk - Nuevo Ticket'
      },
      {
        // La gestión de Usuarios solo está disponible para administradores.
        path: 'users',
        loadComponent: () => import('./pages/admin/admin.component')
          .then((module) => module.AdminComponent),
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
