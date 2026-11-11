import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { collection, doc, getDoc, getDocs, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../core/firebase.config';
import { Ticket, TicketCategory, TicketPriority } from '../../models/ticket';
import { TicketManagementChanges, TicketsService } from '../../services/tickets';

/** Estados simplificados que se muestran en la lista de tickets. */
type TicketDisplayStatus = 'Nuevo' | 'Asignado' | 'Cerrado';

/** Filtro disponible para limitar la lista por estado. */
type TicketStatusFilter = 'Todos los estados' | TicketDisplayStatus;

/** Identifica cuál de los desplegables de edición de ticket está abierto. */
type TicketEditDropdown = 'category' | 'state' | 'technician' | null;

/** Datos mínimos del técnico que puede asignarse desde la edición del ticket. */
interface TechnicianOption {
  uid: string;
  username: string;
  department: string;
}

/** Tiempo máximo que la interfaz espera a Auth y Firestore antes de permitir reintentar. */
const TICKET_LOAD_TIMEOUT_MS = 15_000;

/** Presenta y filtra exclusivamente los tickets creados por la persona actual. */
@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './tickets.component.html',
  styleUrl: './tickets.component.css'
})
export class TicketsComponent implements OnInit {
  /** Tickets propios recuperados desde Firestore. */
  tickets: Ticket[] = [];
  /** Texto que se compara con el ID, título, solicitante y categoría. */
  searchTerm = '';
  /** Estado seleccionado para el filtro de la tabla. */
  statusFilter: TicketStatusFilter = 'Todos los estados';
  /** Controla la visibilidad del menú personalizado de estados. */
  isStatusMenuOpen = false;
  /** Desplegable personalizado abierto en el formulario de edición. */
  openTicketEditDropdown: TicketEditDropdown = null;
  /** Indica que todavía se está consultando Firestore. */
  isLoading = true;
  /** Error visible y reintentable si falla la consulta. */
  loadError = '';
  /** Error visible cuando no se logra verificar el rol del perfil actual. */
  permissionError = '';
  /** Error al consultar técnicos disponibles para la edición. */
  technicianLoadError = '';
  /** Indica que el perfil autenticado puede gestionar los campos permitidos. */
  canManageTickets = false;
  /** Técnicos habilitados que pueden asignarse a los tickets. */
  technicians: TechnicianOption[] = [];
  /** Indica que se está consultando el directorio técnico. */
  isLoadingTechnicians = false;
  /** Ticket seleccionado para consultar su descripción completa. */
  selectedTicket: Ticket | null = null;
  /** Indica si el diálogo muestra los campos editables del ticket. */
  isEditingTicket = false;
  /** Indica que el cambio del ticket se está guardando. */
  isSavingTicket = false;
  /** Mensaje de error del guardado de categoría, estado o asignación. */
  ticketEditError = '';
  /** Valores editables permitidos para la incidencia seleccionada. */
  ticketEditForm: TicketManagementChanges = this.createEmptyTicketEditForm();
  /** Categorías que los perfiles autorizados pueden asignar a un ticket. */
  readonly categoryOptions: TicketCategory[] = [
    'Soporte Técnico',
    'Redes y comunicaciones',
    'Desarrollador de sistema'
  ];
  /** Estados persistidos y etiquetas visibles para el equipo de soporte. */
  readonly ticketEditStatusOptions: Array<{
    value: Ticket['estado'];
    label: string;
  }> = [
    { value: 'abierto', label: 'Abierto (Nuevo)' },
    { value: 'en proceso', label: 'En proceso (Asignado)' },
    { value: 'cerrado', label: 'Cerrado' }
  ];
  /** Catálogo de estados que se ofrece en el filtro. */
  readonly statusOptions: TicketStatusFilter[] = [
    'Todos los estados',
    'Nuevo',
    'Asignado',
    'Cerrado'
  ];

  /** Recibe la persistencia y el detector para reflejar respuestas de Firebase. */
  constructor(
    private ticketsService: TicketsService,
    private changeDetector: ChangeDetectorRef
  ) {}

  /** Espera a Firebase Auth y obtiene solo los tickets del UID autenticado. */
  async ngOnInit(): Promise<void> {
    await auth.authStateReady();
    const userId = auth.currentUser?.uid;

    if (!userId) {
      await this.loadTickets();
      return;
    }

    try {
      const profile = await this.withLoadTimeout(
        getDoc(doc(db, 'users', userId)),
        'La consulta de permisos tardó demasiado.'
      );
      const role = profile.data()?.['role'];
      this.canManageTickets = role === 'admin' || role === 'technician';
    } catch (error) {
      console.error('Error al verificar permisos para gestionar tickets:', error);
      this.permissionError = 'No se pudieron verificar tus permisos para editar tickets.';
    }

    await Promise.all([
      this.loadTickets(),
      this.canManageTickets ? this.loadTechnicians() : Promise.resolve()
    ]);
    this.changeDetector.markForCheck();
  }

  /** Número de tickets propios que continúan activos. */
  get activeTicketCount(): number {
    return this.tickets.filter(ticket => this.getDisplayStatus(ticket) !== 'Cerrado').length;
  }

  /** Lista filtrada por texto y estado, conservando primero los más recientes. */
  get filteredTickets(): Ticket[] {
    const search = this.searchTerm.trim().toLocaleLowerCase('es');

    return this.tickets.filter(ticket => {
      const matchesStatus = this.statusFilter === 'Todos los estados'
        || this.getDisplayStatus(ticket) === this.statusFilter;
      const searchableText = [
        this.getTicketNumber(ticket),
        ticket.titulo,
        ticket.descripcion,
        ticket.clienteNombre,
        ticket.categoria,
        this.getPriorityLabel(ticket.prioridad),
        this.getDisplayStatus(ticket)
      ].join(' ').toLocaleLowerCase('es');

      return matchesStatus && (!search || searchableText.includes(search));
    });
  }

  /** Consulta Firestore de nuevo, manteniendo el listado restringido al solicitante. */
  async loadTickets(): Promise<void> {
    this.isLoading = true;
    this.loadError = '';

    try {
      this.tickets = await this.withLoadTimeout(
        this.getOwnTickets(),
        'La consulta de tickets tardó demasiado.'
      );
    } catch (error) {
      console.error('Error al cargar los tickets propios:', error);
      this.loadError = error instanceof Error && error.message.startsWith('TICKET_LOAD_TIMEOUT')
        ? 'La consulta está tardando demasiado. Revisa tu conexión y los permisos de Firestore; después inténtalo de nuevo.'
        : 'No se pudieron cargar tus tickets. Revisa tu conexión y los permisos de Firestore e inténtalo de nuevo.';
    } finally {
      this.isLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  /** Obtiene la lista propia una vez que Firebase Auth confirma la sesión actual. */
  private async getOwnTickets(): Promise<Ticket[]> {
    await auth.authStateReady();
    const userId = auth.currentUser?.uid;
    if (!userId) {
      throw new Error('No hay una sesión autenticada para consultar tickets.');
    }

    return this.ticketsService.listarPropios(userId);
  }

  /** Carga los técnicos habilitados para completar las asignaciones del formulario. */
  async loadTechnicians(): Promise<void> {
    this.isLoadingTechnicians = true;
    this.technicianLoadError = '';

    try {
      const snapshot = await this.withLoadTimeout(
        getDocs(collection(db, 'technicianDirectory')),
        'La consulta de técnicos tardó demasiado.'
      );
      this.technicians = snapshot.docs
        .map(technicianDocument => {
          const technician = technicianDocument.data();
          return {
            uid: technicianDocument.id,
            username: typeof technician['username'] === 'string'
              ? technician['username']
              : 'Técnico',
            department: typeof technician['department'] === 'string'
              ? technician['department']
              : ''
          };
        })
        .sort((first, second) => first.username.localeCompare(second.username, 'es'));
    } catch (error) {
      console.error('Error al cargar los técnicos para asignación:', error);
      this.technicianLoadError = 'No se pudo cargar el directorio técnico. Reintenta antes de asignar un técnico.';
    } finally {
      this.isLoadingTechnicians = false;
      this.changeDetector.markForCheck();
    }
  }

  /** Selecciona un estado del menú y cierra sus opciones. */
  selectStatusFilter(status: TicketStatusFilter): void {
    this.statusFilter = status;
    this.isStatusMenuOpen = false;
  }

  /** Cierra el menú de estados al pulsar fuera de su control. */
  @HostListener('document:click', ['$event'])
  closeStatusMenuOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.status-dropdown')) {
      this.isStatusMenuOpen = false;
    }
    if (!(target instanceof Element) || !target.closest('.ticket-edit-dropdown')) {
      this.openTicketEditDropdown = null;
    }
  }

  /** Cierra los menús personalizados al presionar Escape. */
  @HostListener('document:keydown.escape')
  closeStatusMenuOnEscape(): void {
    this.isStatusMenuOpen = false;
    this.openTicketEditDropdown = null;
  }

  /** Abre el desplegable indicado y cierra cualquier otro del editor. */
  toggleTicketEditDropdown(dropdown: Exclude<TicketEditDropdown, null>): void {
    this.openTicketEditDropdown = this.openTicketEditDropdown === dropdown ? null : dropdown;
  }

  /** Selecciona una categoría del menú personalizado. */
  selectTicketCategory(category: TicketCategory): void {
    this.ticketEditForm.categoria = category;
    this.openTicketEditDropdown = null;
  }

  /** Selecciona un estado del menú personalizado. */
  selectTicketState(state: Ticket['estado']): void {
    this.ticketEditForm.estado = state;
    this.openTicketEditDropdown = null;
  }

  /** Selecciona o quita la asignación desde el menú personalizado. */
  selectAssignedTechnician(uid: string): void {
    const technician = this.technicians.find(option => option.uid === uid);
    this.ticketEditForm.tecnicoAsignadoId = technician?.uid ?? '';
    this.ticketEditForm.tecnicoAsignadoNombre = technician?.username ?? '';
    this.openTicketEditDropdown = null;
  }

  /** Obtiene la etiqueta visible del estado seleccionado en el editor. */
  getSelectedEditStateLabel(): string {
    return this.ticketEditStatusOptions.find(option => option.value === this.ticketEditForm.estado)?.label
      ?? 'Seleccionar estado';
  }

  /** Obtiene el nombre del técnico elegido, conservando el actual si no aparece en el directorio. */
  getSelectedTechnicianLabel(): string {
    if (!this.ticketEditForm.tecnicoAsignadoId) {
      return 'Sin asignar';
    }

    return this.technicians.find(option => option.uid === this.ticketEditForm.tecnicoAsignadoId)?.username
      ?? this.selectedTicket?.tecnicoAsignadoNombre
      ?? 'Técnico no disponible';
  }

  /** Libera la interfaz si Firebase mantiene pendiente la operación de lectura. */
  private async withLoadTimeout<T>(
    operation: Promise<T>,
    timeoutMessage = 'TICKET_LOAD_TIMEOUT'
  ): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(timeoutMessage === 'TICKET_LOAD_TIMEOUT'
          ? timeoutMessage
          : `TICKET_LOAD_TIMEOUT: ${timeoutMessage}`)),
        TICKET_LOAD_TIMEOUT_MS
      );
    });

    try {
      return await Promise.race([operation, timeout]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  /** Traduce el estado almacenado y la asignación al vocabulario de la pantalla. */
  getDisplayStatus(ticket: Ticket): TicketDisplayStatus {
    if (ticket.estado === 'cerrado') {
      return 'Cerrado';
    }

    if (ticket.estado === 'en proceso' || Boolean(ticket.tecnicoAsignadoId)) {
      return 'Asignado';
    }

    return 'Nuevo';
  }

  /** Devuelve el número nuevo en formato TKD o el ID original para históricos. */
  getTicketNumber(ticket: Ticket): string {
    if (typeof ticket.numero === 'number' && Number.isSafeInteger(ticket.numero) && ticket.numero > 0) {
      return `TKD-${String(ticket.numero).padStart(4, '0')}`;
    }

    return ticket.id ?? '—';
  }

  /** Convierte fechas de Firestore en fechas nativas para el pipe de Angular. */
  getCreationDate(ticket: Ticket): Date | null {
    const value = ticket.fechaCreacion;
    if (value instanceof Date) {
      return value;
    }

    if (value instanceof Timestamp) {
      return value.toDate();
    }

    return null;
  }

  /** Convierte las prioridades internas en etiquetas legibles en español. */
  getPriorityLabel(priority: TicketPriority): string {
    const labels: Record<TicketPriority, string> = {
      urgente: 'Urgente',
      alta: 'Alta',
      media: 'Media',
      baja: 'Baja'
    };
    return labels[priority];
  }

  /** Devuelve la clase visual asociada a la prioridad del ticket. */
  getPriorityClass(priority: TicketPriority): string {
    return `priority-${priority}`;
  }

  /** Abre los detalles del ticket seleccionado. */
  showDetails(ticket: Ticket): void {
    this.selectedTicket = ticket;
    this.isEditingTicket = false;
    this.ticketEditError = '';
  }

  /** Cierra el panel de detalles sin alterar el ticket. */
  closeDetails(): void {
    if (this.isSavingTicket) {
      return;
    }
    this.selectedTicket = null;
    this.isEditingTicket = false;
    this.ticketEditError = '';
  }

  /** Prepara el formulario con los valores actuales de la incidencia. */
  beginTicketEdit(ticket: Ticket): void {
    if (!this.canManageTickets) {
      return;
    }

    this.ticketEditForm = {
      categoria: ticket.categoria,
      estado: ticket.estado,
      tecnicoAsignadoId: ticket.tecnicoAsignadoId ?? '',
      tecnicoAsignadoNombre: ticket.tecnicoAsignadoNombre ?? ''
    };
    this.ticketEditError = '';
    this.isEditingTicket = true;
    this.openTicketEditDropdown = null;
  }

  /** Descarta los cambios locales y regresa a la consulta del ticket. */
  cancelTicketEdit(): void {
    if (this.isSavingTicket) {
      return;
    }
    this.isEditingTicket = false;
    this.ticketEditError = '';
    this.openTicketEditDropdown = null;
  }

  /** Valida y guarda únicamente categoría, estado y técnico asignado. */
  async saveTicketChanges(): Promise<void> {
    const ticket = this.selectedTicket;
    if (!ticket?.id || !this.canManageTickets || this.isSavingTicket) {
      return;
    }

    const assignedTechnician = this.ticketEditForm.tecnicoAsignadoId
      ? this.technicians.find(technician => technician.uid === this.ticketEditForm.tecnicoAsignadoId)
      : undefined;

    if (this.ticketEditForm.tecnicoAsignadoId && !assignedTechnician) {
      this.ticketEditError = this.technicianLoadError
        || 'El técnico seleccionado ya no está disponible. Actualiza la lista e inténtalo de nuevo.';
      return;
    }

    this.ticketEditError = '';
    this.isSavingTicket = true;

    try {
      const changes: TicketManagementChanges = {
        categoria: this.ticketEditForm.categoria,
        estado: this.ticketEditForm.estado,
        tecnicoAsignadoId: assignedTechnician?.uid ?? '',
        tecnicoAsignadoNombre: assignedTechnician?.username ?? ''
      };
      await this.ticketsService.actualizarGestion(ticket.id, changes);

      const updatedTicket: Ticket = {
        ...ticket,
        categoria: changes.categoria,
        estado: changes.estado
      };
      if (changes.tecnicoAsignadoId) {
        updatedTicket.tecnicoAsignadoId = changes.tecnicoAsignadoId;
        updatedTicket.tecnicoAsignadoNombre = changes.tecnicoAsignadoNombre;
      } else {
        delete updatedTicket.tecnicoAsignadoId;
        delete updatedTicket.tecnicoAsignadoNombre;
      }

      this.tickets = this.tickets.map(existingTicket =>
        existingTicket.id === ticket.id ? updatedTicket : existingTicket
      );
      this.selectedTicket = updatedTicket;
      this.isEditingTicket = false;
      this.openTicketEditDropdown = null;
    } catch (error) {
      console.error('Error al actualizar los campos de gestión del ticket:', error);
      this.ticketEditError = error instanceof Error && error.message.includes('permission')
        ? 'No tienes permisos para cambiar este ticket. Verifica que las reglas de Firestore estén actualizadas.'
        : 'No se pudieron guardar los cambios. Revisa tu conexión e inténtalo de nuevo.';
    } finally {
      this.isSavingTicket = false;
      this.changeDetector.markForCheck();
    }
  }

  /** Genera un estado inicial seguro para el formulario de gestión. */
  private createEmptyTicketEditForm(): TicketManagementChanges {
    return {
      categoria: 'Soporte Técnico',
      estado: 'abierto',
      tecnicoAsignadoId: '',
      tecnicoAsignadoNombre: ''
    };
  }

  /** Proporciona una clave estable para que Angular actualice las filas correctamente. */
  trackByTicketId(index: number, ticket: Ticket): string | number {
    return ticket.id ?? index;
  }
}
