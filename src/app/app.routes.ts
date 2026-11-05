import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { CompleteProfileComponent } from './pages/complete-profile/complete-profile.component';
import { AdminComponent } from './pages/admin/admin.component';
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
    // canActivate: [authGuard, profileGuard] -> Doble protección:
    // 1. Debe estar autenticado.
    // 2. Debe tener su perfil completado en la base de datos.
    path: 'dashboard', 
    component: DashboardComponent, 
    canActivate: [authGuard, profileGuard],
    title: 'TicketDesk - Panel Principal'
  },
  { 
    // Ruta de Administración de Usuarios.
    // canActivate: [authGuard, profileGuard, roleGuard] -> Triple protección:
    // 1. Debe estar autenticado.
    // 2. Debe tener perfil completo.
    // 3. Debe tener el rol de 'admin' definido en la data de la ruta.
    path: 'admin', 
    component: AdminComponent, 
    canActivate: [authGuard, profileGuard, roleGuard],
    data: { role: 'admin' },
    title: 'TicketDesk - Administración'
  },
  { 
    // Comodín (Wildcard): Captura cualquier ruta no definida anteriormente y redirige al inicio.
    path: '**', 
    redirectTo: '' 
  }
];
