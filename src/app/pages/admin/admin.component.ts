import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../../core/firebase.config';
import {
  AdminUsersService,
  ManagedUser,
  ManagedUserRole
} from '../../services/admin-users.service';

/** Filtros disponibles para las pestañas de resumen del directorio. */
type UserFilter = 'all' | 'user' | 'technician' | 'admin';
/** Estados del diálogo de consulta y cambio de rol. */
type UserDialogMode = 'details' | 'edit-role';

/** Tiempo máximo que la pantalla espera una respuesta de Firestore. */
const USERS_LOAD_TIMEOUT_MS = 15000;

/** Rol seleccionado en el formulario de administración. */
interface UserForm {
  role: ManagedUserRole;
}

/** Presentación del rol disponible en el selector personalizado. */
interface RoleOption {
  value: ManagedUserRole;
  label: string;
  description: string;
  icon: string;
}

/**
 * Muestra los perfiles registrados, métricas calculadas desde Firestore,
 * filtros, paginación y cambios de rol autorizados por las reglas de Firestore.
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  /** Perfiles recuperados de la colección real de Firebase. */
  users: ManagedUser[] = [];
  /** Indica que Firestore está cargando o actualizando los perfiles. */
  isLoading = false;
  /** Mensaje mostrado cuando Firestore no puede devolver los perfiles. */
  loadError = '';
  /** Texto que limita los resultados por nombre, correo o departamento. */
  searchTerm = '';
  /** Departamento elegido en el filtro de la tabla. */
  selectedDepartment = '';
  /** Filtro de rol activo en las pestañas de resumen. */
  activeFilter: UserFilter = 'all';
  /** Controla la visibilidad del menú personalizado de departamentos. */
  isDepartmentMenuOpen = false;
  /** Tamaños de página disponibles para la tabla. */
  readonly pageSizeOptions = [10, 20, 30];
  /** Cantidad de perfiles que se presentan por página. */
  pageSize = 10;
  /** Página actual, iniciada en la primera página del resultado filtrado. */
  currentPage = 1;
  /** Perfil visible dentro del diálogo de detalles o cambio de rol. */
  selectedUser: ManagedUser | null = null;
  /** Modo activo del diálogo de perfil. */
  dialogMode: UserDialogMode = 'details';
  /** Rol seleccionado en el formulario de cambio. */
  userForm: UserForm = this.createEmptyForm();
  /** Controla la visibilidad del menú personalizado de roles. */
  isRoleMenuOpen = false;
  /** Error de validación o respuesta de la actualización del rol. */
  dialogError = '';
  /** Indica que el cambio de rol está en curso. */
  isSavingUser = false;
  /** Filtros de rol con etiquetas y conteos derivados de cuentas reales. */
  readonly roleFilters: Array<{ key: UserFilter; label: string }> = [
    { key: 'all', label: 'Todos' },
    { key: 'user', label: 'Usuarios' },
    { key: 'technician', label: 'Técnicos' },
    { key: 'admin', label: 'Administradores' }
  ];
  /** Opciones visuales que puede elegir el administrador para el perfil. */
  readonly roleOptions: RoleOption[] = [
    {
      value: 'user',
      label: 'Usuario',
      description: 'Acceso a tickets y perfil personal.',
      icon: 'person'
    },
    {
      value: 'technician',
      label: 'Técnico',
      description: 'Acceso al panel técnico y asignación de tickets.',
      icon: 'support_agent'
    },
    {
      value: 'admin',
      label: 'Administrador',
      description: 'Acceso a la administración del sistema.',
      icon: 'admin_panel_settings'
    }
  ];

  /** Carga los perfiles registrados al abrir la sección de administración. */
  async ngOnInit(): Promise<void> {
    await this.loadUsers();
  }

  /** Recupera los perfiles directamente desde Firestore, como en la versión que ya funcionaba. */
  async loadUsers(): Promise<void> {
    this.isLoading = true;
    this.loadError = '';

    try {
      const snapshot = await this.withTimeout(
        getDocs(collection(db, 'users')),
        USERS_LOAD_TIMEOUT_MS,
        'La consulta de usuarios tardó demasiado. Comprueba tu conexión e inténtalo de nuevo.'
      );
      this.users = snapshot.docs.map((userDocument) => {
        const data = userDocument.data();
        const storedRole = data['role'];

        return {
          uid: userDocument.id,
          email: this.readString(data['email']),
          username: this.readString(data['username']) || 'Sin nombre',
          department: this.readString(data['department']) || 'Sin departamento',
          phone: this.readString(data['phone']),
          role: storedRole === 'admin' || storedRole === 'technician'
            ? storedRole
            : 'user'
        };
      }).sort((first, second) => first.username.localeCompare(second.username, 'es'));
      this.currentPage = 1;
    } catch (error) {
      console.error('Error al cargar el directorio de usuarios:', error);
      this.loadError = this.errorMessage(
        error,
        'No se pudieron cargar las cuentas. Intenta actualizar la lista.'
      );
    } finally {
      this.isLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  /** Recibe los servicios de persistencia y actualización de la vista. */
  constructor(
    private adminUsersService: AdminUsersService,
    private changeDetector: ChangeDetectorRef
  ) {}

  /** Evita que una consulta pendiente mantenga indefinidamente el indicador de carga. */
  private async withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(message)), milliseconds);
        })
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /** Devuelve un mensaje útil para errores callable sin ocultar fallos desconocidos. */
  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return fallback;
  }

  /** Devuelve un valor de Firestore como texto únicamente cuando es una cadena. */
  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  /** Genera el estado inicial del selector de rol. */
  private createEmptyForm(): UserForm {
    return {
      role: 'user'
    };
  }

  /** Devuelve la lista única de departamentos presentes en los perfiles reales. */
  get departments(): string[] {
    return [...new Set(
      this.users
        .map((user) => user.department)
        .filter((department) => department && department !== 'Sin departamento')
    )].sort((first, second) => first.localeCompare(second, 'es'));
  }

  /** Filtra por la pestaña activa, el departamento y el texto de búsqueda. */
  get filteredUsers(): ManagedUser[] {
    const search = this.searchTerm.trim().toLocaleLowerCase('es');

    return this.users.filter((user) => {
      const matchesRole = this.activeFilter === 'all' || user.role === this.activeFilter;
      const matchesDepartment = !this.selectedDepartment
        || user.department === this.selectedDepartment;
      const searchableText = `${user.username} ${user.email} ${user.department}`
        .toLocaleLowerCase('es');
      return matchesRole && matchesDepartment && searchableText.includes(search);
    });
  }

  /** Presenta la porción paginada de la lista filtrada. */
  get paginatedUsers(): ManagedUser[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredUsers.slice(start, start + this.pageSize);
  }

  /** Cantidad de páginas para el conjunto de resultados actual. */
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize));
  }

  /** Índice del primer perfil presentado, o cero cuando no hay resultados. */
  get rangeStart(): number {
    return this.filteredUsers.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  /** Índice del último perfil presentado en la página actual. */
  get rangeEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredUsers.length);
  }

  /** Cuenta los perfiles que coinciden con la pestaña, sin filtros secundarios. */
  countFor(filter: UserFilter): number {
    return filter === 'all'
      ? this.users.length
      : this.users.filter((user) => user.role === filter).length;
  }

  /** Devuelve el total de técnicos activos en el directorio de perfiles. */
  get technicianCount(): number {
    return this.countFor('technician');
  }

  /** Cambia la pestaña y devuelve la tabla a la primera página. */
  selectFilter(filter: UserFilter): void {
    this.activeFilter = filter;
    this.currentPage = 1;
  }

  /** Limpia filtros de tabla para volver a mostrar el directorio completo. */
  private resetDirectoryFilters(): void {
    this.activeFilter = 'all';
    this.searchTerm = '';
    this.selectedDepartment = '';
    this.currentPage = 1;
  }

  /** Reinicia la página cuando cambia cualquiera de los filtros de tabla. */
  resetPagination(): void {
    this.currentPage = 1;
  }

  /** Selecciona un departamento y reinicia la tabla en su primera página. */
  selectDepartment(department: string): void {
    this.selectedDepartment = department;
    this.currentPage = 1;
    this.isDepartmentMenuOpen = false;
  }

  /** Alterna el menú personalizado de departamentos. */
  toggleDepartmentMenu(): void {
    this.isDepartmentMenuOpen = !this.isDepartmentMenuOpen;
  }

  /** Cierra los selectores personalizados al pulsar fuera de ellos. */
  @HostListener('document:click', ['$event'])
  closeMenusOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.department-dropdown')) {
      this.isDepartmentMenuOpen = false;
    }

    if (!(target instanceof Element) || !target.closest('.role-picker')) {
      this.isRoleMenuOpen = false;
    }
  }

  /** Cambia la cantidad de filas y conserva una página válida. */
  changePageSize(value: number | string): void {
    const parsedSize = Number(value);
    if (this.pageSizeOptions.includes(parsedSize)) {
      this.pageSize = parsedSize;
      this.currentPage = 1;
    }
  }

  /** Avanza una página cuando existen resultados posteriores. */
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
    }
  }

  /** Regresa una página cuando existen resultados anteriores. */
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
    }
  }

  /** Abre los detalles del perfil elegido. */
  showDetails(user: ManagedUser): void {
    this.selectedUser = user;
    this.dialogMode = 'details';
    this.dialogError = '';
  }

  /** Indica si el administrador puede asignar un rol al perfil seleccionado. */
  canChangeRole(user: ManagedUser | null): boolean {
    return !!user && user.uid !== auth.currentUser?.uid && user.role !== 'admin';
  }

  /** Abre el selector de rol para una cuenta distinta a la sesión actual. */
  beginEdit(): void {
    if (!this.selectedUser || !this.canChangeRole(this.selectedUser)) {
      return;
    }

    this.dialogMode = 'edit-role';
    this.dialogError = '';
    this.userForm = { role: this.selectedUser.role };
    this.isRoleMenuOpen = false;
  }

  /** Alterna la apertura del selector personalizado de roles. */
  toggleRoleMenu(): void {
    this.isRoleMenuOpen = !this.isRoleMenuOpen;
  }

  /** Selecciona un rol disponible y cierra el menú. */
  selectRole(role: ManagedUserRole): void {
    this.userForm.role = role;
    this.isRoleMenuOpen = false;
  }

  /** Devuelve el icono visual asociado al rol seleccionado. */
  roleIcon(role: ManagedUserRole): string {
    return this.roleOptions.find((option) => option.value === role)?.icon ?? 'person';
  }

  /** Cierra el selector personalizado al presionar Escape. */
  @HostListener('document:keydown.escape')
  closeRoleMenuOnEscape(): void {
    this.isRoleMenuOpen = false;
    this.isDepartmentMenuOpen = false;
  }

  /** Descarta el rol pendiente y vuelve a los detalles del perfil. */
  cancelDialogEdit(): void {
    if (this.dialogMode === 'edit-role' && this.selectedUser) {
      this.showDetails(this.selectedUser);
      return;
    }
    this.closeDetails();
  }

  /** Guarda únicamente el rol y actualiza la lista después de confirmarlo en Firestore. */
  async saveUser(): Promise<void> {
    this.dialogError = '';
    if (this.dialogMode !== 'edit-role' || !this.selectedUser || !this.canChangeRole(this.selectedUser)) {
      return;
    }

    const selectedUser = this.selectedUser;
    const selectedRole = this.userForm.role;
    if (selectedRole === 'user' && selectedUser.role !== 'user') {
      this.dialogError = 'No se permite quitar roles elevados desde esta pantalla.';
      return;
    }

    this.isSavingUser = true;
    try {
      if (selectedRole !== selectedUser.role) {
        await this.adminUsersService.updateRole({
          uid: selectedUser.uid,
          username: selectedUser.username,
          department: selectedUser.department,
          role: selectedRole
        });
        this.users = this.users.map((user) => user.uid === selectedUser.uid
          ? { ...user, role: selectedRole }
          : user);
      }

      this.resetDirectoryFilters();
      this.closeDetails();
      await this.loadUsers();
    } catch (error) {
      console.error('Error al cambiar el rol del usuario:', error);
      this.dialogError = this.errorMessage(
        error,
        'No se pudo cambiar el rol. Comprueba los permisos de Firestore e inténtalo de nuevo.'
      );
    } finally {
      this.isSavingUser = false;
      this.changeDetector.markForCheck();
    }
  }

  /** Cierra el panel de detalles de la cuenta. */
  closeDetails(): void {
    this.selectedUser = null;
    this.dialogMode = 'details';
    this.dialogError = '';
    this.userForm = this.createEmptyForm();
    this.isRoleMenuOpen = false;
  }

  /** Convierte el identificador de rol en el nombre mostrado en la interfaz. */
  roleLabel(role: ManagedUserRole): string {
    if (role === 'admin') {
      return 'Administrador';
    }
    return role === 'technician' ? 'Técnico' : 'Usuario';
  }

  /** Calcula las iniciales del usuario para el avatar de tabla y detalles. */
  initials(username: string): string {
    return username
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }
}
