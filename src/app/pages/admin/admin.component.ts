import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../core/firebase.config';
import {
  AdminUsersService,
  CreateManagedUserRequest,
  ManagedUser,
  ManagedUserRole,
  UpdateManagedUserRequest
} from '../../services/admin-users.service';

/** Filtros disponibles para las pestañas de resumen del directorio. */
type UserFilter = 'all' | 'user' | 'technician' | 'admin';
/** Estados del diálogo compartido por alta, consulta y edición. */
type UserDialogMode = 'create' | 'details' | 'edit';

/** Valores capturados en el formulario de una cuenta. */
interface UserForm {
  email: string;
  password: string;
  username: string;
  department: string;
  phone: string;
  role: ManagedUserRole;
}

/**
 * Muestra los perfiles registrados, métricas calculadas desde Firestore,
 * filtros, paginación y operaciones CRUD delegadas a Firebase Functions.
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
  /** Tamaños de página disponibles para la tabla. */
  readonly pageSizeOptions = [10, 20, 30];
  /** Cantidad de perfiles que se presentan por página. */
  pageSize = 10;
  /** Página actual, iniciada en la primera página del resultado filtrado. */
  currentPage = 1;
  /** Perfil visible dentro del diálogo de alta, detalles o edición. */
  selectedUser: ManagedUser | null = null;
  /** Modo activo de la ventana CRUD. */
  dialogMode: UserDialogMode = 'details';
  /** Datos del formulario de alta o edición. */
  userForm: UserForm = this.createEmptyForm();
  /** Error de validación o respuesta de las operaciones CRUD. */
  dialogError = '';
  /** Indica que una operación de alta, edición o eliminación está en curso. */
  isSavingUser = false;
  /** Filtros de rol con etiquetas y conteos derivados de cuentas reales. */
  readonly roleFilters: Array<{ key: UserFilter; label: string }> = [
    { key: 'all', label: 'Todos' },
    { key: 'user', label: 'Usuarios' },
    { key: 'technician', label: 'Técnicos' },
    { key: 'admin', label: 'Administradores' }
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
      const snapshot = await getDocs(collection(db, 'users'));
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
    }
  }

  /** Recibe el servicio que valida permisos y ejecuta operaciones de cuentas. */
  constructor(private adminUsersService: AdminUsersService) {}

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

  /** Genera un formulario limpio para una cuenta nueva. */
  private createEmptyForm(): UserForm {
    return {
      email: '',
      password: '',
      username: '',
      department: '',
      phone: '',
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

  /** Reinicia la página cuando cambia cualquiera de los filtros de tabla. */
  resetPagination(): void {
    this.currentPage = 1;
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

  /** Abre el diálogo vacío para crear una cuenta con credenciales iniciales. */
  openCreateDialog(): void {
    this.selectedUser = null;
    this.dialogMode = 'create';
    this.dialogError = '';
    this.userForm = this.createEmptyForm();
  }

  /** Abre los detalles de solo lectura del perfil elegido. */
  showDetails(user: ManagedUser): void {
    this.selectedUser = user;
    this.dialogMode = 'details';
    this.dialogError = '';
  }

  /** Habilita la edición de nombre, departamento, teléfono y rol. */
  beginEdit(): void {
    if (!this.selectedUser) {
      return;
    }

    this.dialogMode = 'edit';
    this.dialogError = '';
    this.userForm = {
      email: this.selectedUser.email,
      password: '',
      username: this.selectedUser.username,
      department: this.selectedUser.department === 'Sin departamento'
        ? ''
        : this.selectedUser.department,
      phone: this.selectedUser.phone,
      role: this.selectedUser.role
    };
  }

  /** Descarta el formulario y vuelve a los detalles o cierra el alta nueva. */
  cancelDialogEdit(): void {
    if (this.dialogMode === 'edit' && this.selectedUser) {
      this.showDetails(this.selectedUser);
      return;
    }
    this.closeDetails();
  }

  /** Guarda una cuenta nueva o los cambios permitidos al perfil seleccionado. */
  async saveUser(): Promise<void> {
    this.dialogError = '';
    const email = this.userForm.email.trim().toLowerCase();
    const username = this.userForm.username.trim();
    const department = this.userForm.department.trim();
    const phone = this.userForm.phone.trim();

    if (!username || !department || !phone) {
      this.dialogError = 'Nombre, departamento y teléfono son obligatorios.';
      return;
    }

    if (this.dialogMode === 'create' && (!email || !this.userForm.password)) {
      this.dialogError = 'Correo y contraseña temporal son obligatorios para crear la cuenta.';
      return;
    }

    if (this.dialogMode === 'create' && this.userForm.password.length < 6) {
      this.dialogError = 'La contraseña temporal debe tener al menos 6 caracteres.';
      return;
    }

    this.isSavingUser = true;
    try {
      if (this.dialogMode === 'create') {
        const request: CreateManagedUserRequest = {
          email,
          password: this.userForm.password,
          username,
          department,
          phone,
          role: this.userForm.role
        };
        await this.adminUsersService.create(request);
      } else if (this.dialogMode === 'edit' && this.selectedUser) {
        const request: UpdateManagedUserRequest = {
          uid: this.selectedUser.uid,
          username,
          department,
          phone,
          role: this.userForm.role
        };
        await this.adminUsersService.update(request);
      }

      this.closeDetails();
      await this.loadUsers();
    } catch (error) {
      console.error('Error al guardar la cuenta:', error);
      this.dialogError = this.errorMessage(
        error,
        'No se pudo guardar la cuenta. Verifica los datos y vuelve a intentar.'
      );
    } finally {
      this.isSavingUser = false;
    }
  }

  /** Solicita confirmación y elimina la cuenta de Authentication y su perfil. */
  async deleteSelectedUser(): Promise<void> {
    if (!this.selectedUser || this.isSavingUser) {
      return;
    }

    const user = this.selectedUser;
    const confirmed = window.confirm(
      `¿Eliminar la cuenta de ${user.username} (${user.email})? Esta acción no se puede deshacer.`
    );
    if (!confirmed) {
      return;
    }

    this.dialogError = '';
    this.isSavingUser = true;
    try {
      await this.adminUsersService.delete(user.uid);
      this.closeDetails();
      await this.loadUsers();
    } catch (error) {
      console.error('Error al eliminar la cuenta:', error);
      this.dialogError = this.errorMessage(
        error,
        'No se pudo eliminar la cuenta. Verifica los permisos e inténtalo de nuevo.'
      );
    } finally {
      this.isSavingUser = false;
    }
  }

  /** Cierra el panel de detalles de la cuenta. */
  closeDetails(): void {
    this.selectedUser = null;
    this.dialogMode = 'details';
    this.dialogError = '';
    this.userForm = this.createEmptyForm();
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
