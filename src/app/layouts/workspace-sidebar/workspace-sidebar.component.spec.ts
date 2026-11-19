import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WorkspaceSidebarComponent } from './workspace-sidebar.component';

describe('WorkspaceSidebarComponent', () => {
  function createSidebar(role: 'admin' | 'technician' | 'user') {
    TestBed.configureTestingModule({
      imports: [WorkspaceSidebarComponent],
      providers: [provideRouter([])]
    });
    const fixture = TestBed.createComponent(WorkspaceSidebarComponent);
    fixture.componentInstance.userRole = role;
    return fixture.componentInstance;
  }

  const routesFor = (role: 'admin' | 'technician' | 'user') =>
    createSidebar(role).visibleNavigationItems.map(item => item.route);

  it('un usuario no ve el Dashboard ni la gestión de usuarios', () => {
    expect(routesFor('user')).toEqual(['/tickets', '/profile', '/new-ticket']);
  });

  it('un técnico ve el Dashboard pero no la gestión de usuarios', () => {
    const routes = routesFor('technician');
    expect(routes).toContain('/dashboard');
    expect(routes).not.toContain('/users');
  });

  it('un administrador ve todas las secciones', () => {
    expect(routesFor('admin')).toEqual(
      ['/dashboard', '/tickets', '/profile', '/users', '/new-ticket']
    );
  });
});
