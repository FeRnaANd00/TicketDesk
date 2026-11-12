import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { collection, doc, getDoc, Timestamp } from 'firebase/firestore';
import { TicketConversationComponent } from '../../components/ticket-conversation/ticket-conversation.component';
import { auth, db } from '../../core/firebase.config';
import { Ticket, TicketPriority } from '../../models/ticket';
import { TicketsService } from '../../services/tickets';

type DashboardRole = 'admin' | 'technician';
type DashboardDropdown = 'status' | 'priority' | null;
type DashboardStatusFilter = 'all' | Ticket['estado'];
type DashboardPriorityFilter = 'all' | TicketPriority;
type DashboardScope = 'mine' | 'all';

interface DashboardFilterOption<T> {
  value: T;
  label: string;
}

const DASHBOARD_LOAD_TIMEOUT_MS = 15_000;

/** Presenta el resumen operativo y los tickets visibles para la sesión actual. */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TicketConversationComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  username = 'Usuario';
  email = '';
  department = '';
  userRole: DashboardRole | null = null;
  currentUserId = '';
  tickets: Ticket[] = [];
  ticketScope: DashboardScope = 'all';
  searchTerm = '';
  statusFilter: DashboardStatusFilter = 'all';
  priorityFilter: DashboardPriorityFilter = 'all';
  openDropdown: DashboardDropdown = null;
  selectedTicket: Ticket | null = null;
  conversationTicket: Ticket | null = null;
  currentPage = 1;
  readonly pageSize = 8;
  isLoading = true;
  loadError = '';

  readonly statusOptions: DashboardFilterOption<DashboardStatusFilter>[] = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'abierto', label: 'Abierto' },
    { value: 'en proceso', label: 'En proceso' },
    { value: 'cerrado', label: 'Resuelto' }
  ];

  readonly priorityOptions: DashboardFilterOption<DashboardPriorityFilter>[] = [
    { value: 'all', label: 'Todas las prioridades' },
    { value: 'urgente', label: 'Urgente' },
    { value: 'alta', label: 'Alta' },
    { value: 'media', label: 'Media' },
    { value: 'baja', label: 'Baja' }
  ];

  constructor(
    private ticketsService: TicketsService,
    private changeDetector: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadDashboard();
  }

  /** Carga el perfil real y limita los tickets al técnico autenticado. */
  async loadDashboard(): Promise<void> {
    this.isLoading = true;
    this.loadError = '';

    try {
      await auth.authStateReady();
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No hay una sesión autenticada.');
      }

      const profile = await this.withTimeout(
        getDoc(doc(db, 'users', user.uid)),
        'La consulta de perfil tardó demasiado.'
      );
      if (!profile.exists()) {
        throw new Error('No encontramos el perfil de esta cuenta.');
      }

      const profileData = profile.data();
      const role = profileData['role'];
      if (role !== 'admin' && role !== 'technician') {
        throw new Error('Esta cuenta no tiene acceso al Dashboard.');
      }

      this.userRole = role;
      this.currentUserId = user.uid;
      this.ticketScope = role === 'technician' ? 'mine' : 'all';
      this.username = this.readString(profileData['username'])
        || user.displayName?.trim()
        || user.email?.split('@')[0]
        || 'Usuario';
      this.email = this.readString(profileData['email']) || user.email || '';
      this.department = this.readString(profileData['department']);

      this.tickets = await this.withTimeout(
        this.ticketsService.listarTodos(),
        'La consulta de tickets tardó demasiado.'
      );
      this.currentPage = 1;
    } catch (error) {
      console.error('Error al cargar el Dashboard:', error);
      this.loadError = error instanceof Error && error.message.trim()
        ? error.message
        : 'No se pudo cargar el Dashboard. Revisa tu conexión e inténtalo de nuevo.';
    } finally {
      this.isLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  get filteredTickets(): Ticket[] {
    const search = this.searchTerm.trim().toLocaleLowerCase('es');

    return this.ticketsInScope.filter((ticket) => {
      const matchesStatus = this.statusFilter === 'all' || this.getTicketDisplayStatus(ticket) === this.statusFilter;
      const matchesPriority = this.priorityFilter === 'all'
        || ticket.prioridad === this.priorityFilter;
      const searchableText = [
        this.getTicketNumber(ticket),
        ticket.titulo,
        ticket.descripcion,
        ticket.clienteNombre,
        ticket.categoria,
        this.getStatusLabel(this.getTicketDisplayStatus(ticket)),
        this.getPriorityLabel(ticket.prioridad)
      ].join(' ').toLocaleLowerCase('es');

      return matchesStatus && matchesPriority && (!search || searchableText.includes(search));
    });
  }

  get ticketsInScope(): Ticket[] {
    return this.ticketScope === 'all'
      ? this.tickets
      : this.tickets.filter(ticket => ticket.tecnicoAsignadoId === this.currentUserId);
  }

  get paginatedTickets(): Ticket[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredTickets.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredTickets.length / this.pageSize));
  }

  get firstVisibleTicket(): number {
    return this.filteredTickets.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get lastVisibleTicket(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredTickets.length);
  }

  get openTicketCount(): number {
    return this.ticketsInScope.filter(ticket => this.getTicketDisplayStatus(ticket) === 'abierto').length;
  }

  get inProgressTicketCount(): number {
    return this.ticketsInScope.filter(ticket => this.getTicketDisplayStatus(ticket) === 'en proceso').length;
  }

  get closedTicketCount(): number {
    return this.ticketsInScope.filter(ticket => this.getTicketDisplayStatus(ticket) === 'cerrado').length;
  }

  get activeTicketCount(): number {
    return this.openTicketCount + this.inProgressTicketCount;
  }

  get myActiveTicketCount(): number {
    return this.tickets
      .filter(ticket => ticket.tecnicoAsignadoId === this.currentUserId)
      .filter(ticket => this.getTicketDisplayStatus(ticket) !== 'cerrado').length;
  }

  get myClosedTicketCount(): number {
    return this.tickets
      .filter(ticket => ticket.tecnicoAsignadoId === this.currentUserId)
      .filter(ticket => this.getTicketDisplayStatus(ticket) === 'cerrado').length;
  }

  get profileInitials(): string {
    return this.username
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toLocaleUpperCase('es');
  }

  get statusFilterLabel(): string {
    return this.statusOptions.find((option) => option.value === this.statusFilter)?.label
      ?? 'Todos los estados';
  }

  get priorityFilterLabel(): string {
    return this.priorityOptions.find((option) => option.value === this.priorityFilter)?.label
      ?? 'Todas las prioridades';
  }

  get ticketListTitle(): string {
    return this.ticketScope === 'mine' ? 'Tickets asignados a mí' : 'Tickets de todos los técnicos';
  }

  get ticketListDescription(): string {
    return this.ticketScope === 'mine'
      ? 'Incidencias asignadas a tu cuenta, incluidas las ya cerradas.'
      : 'Consulta tickets de todos los técnicos; solo puedes gestionar los que te corresponden.';
  }

  get ticketListCountLabel(): string {
    return this.ticketScope === 'mine'
      ? `${this.activeTicketCount} activos`
      : `${this.ticketsInScope.length} tickets`;
  }

  /** Cambia el alcance entre tickets propios y la cola completa de técnicos. */
  selectTicketScope(scope: DashboardScope): void {
    this.ticketScope = scope;
    this.currentPage = 1;
  }

  /** Devuelve el estado operativo considerando que los tickets asignados están en proceso. */
  getTicketDisplayStatus(ticket: Ticket): Ticket['estado'] {
    if (ticket.estado === 'cerrado') {
      return 'cerrado';
    }
    return ticket.estado === 'en proceso' || Boolean(ticket.tecnicoAsignadoId)
      ? 'en proceso'
      : 'abierto';
  }

  /** Determina si el usuario actual es parte autorizada de la conversación. */
  canViewConversation(ticket: Ticket): boolean {
    return this.userRole === 'admin'
      || ticket.clienteId === this.currentUserId
      || (this.userRole === 'technician'
        && ticket.tecnicoAsignadoId === this.currentUserId);
  }

  /** Parametriza la tabla de tickets para abrirla con estado y alcance seleccionados. */
  getTicketListQueryParams(status: Ticket['estado']): Record<string, string> {
    return { status, scope: this.ticketScope };
  }

  /** Abre y cierra los menús de filtro y descarta los filtros al elegir una opción. */
  toggleDropdown(dropdown: Exclude<DashboardDropdown, null>): void {
    this.openDropdown = this.openDropdown === dropdown ? null : dropdown;
  }

  selectStatusFilter(status: DashboardStatusFilter): void {
    this.statusFilter = status;
    this.currentPage = 1;
    this.openDropdown = null;
  }

  selectPriorityFilter(priority: DashboardPriorityFilter): void {
    this.priorityFilter = priority;
    this.currentPage = 1;
    this.openDropdown = null;
  }

  @HostListener('document:click', ['$event'])
  closeDropdownOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.dashboard-filter')) {
      this.openDropdown = null;
    }
  }

  @HostListener('document:keydown.escape')
  closeOverlaysOnEscape(): void {
    this.openDropdown = null;
    this.selectedTicket = null;
  }

  showDetails(ticket: Ticket): void {
    this.selectedTicket = ticket;
    this.conversationTicket = null;
  }

  /** Abre la conversación de un ticket que aparece en la lista asignada o global. */
  openConversation(ticket: Ticket): void {
    if (!this.canViewConversation(ticket)) {
      return;
    }
    this.conversationTicket = ticket;
    this.selectedTicket = null;
  }

  /** Cierra la conversación y deja visible el detalle del ticket. */
  closeConversation(): void {
    this.selectedTicket = this.conversationTicket;
    this.conversationTicket = null;
  }

  /** Refleja en contadores y listado la resolución guardada en Firestore. */
  markTicketResolved(ticket: Ticket): void {
    const resolvedTicket: Ticket = { ...ticket, estado: 'cerrado' };
    this.tickets = this.tickets.map(existingTicket =>
      existingTicket.id === ticket.id ? resolvedTicket : existingTicket
    );
    if (this.selectedTicket?.id === ticket.id) {
      this.selectedTicket = resolvedTicket;
    }
    this.conversationTicket = resolvedTicket;
    this.changeDetector.markForCheck();
  }

  closeDetails(): void {
    this.selectedTicket = null;
    this.conversationTicket = null;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  trackByTicketId(index: number, ticket: Ticket): string | number {
    return ticket.id ?? index;
  }

  getTicketNumber(ticket: Ticket): string {
    if (typeof ticket.numero === 'number' && Number.isSafeInteger(ticket.numero) && ticket.numero > 0) {
      return `TKD-${String(ticket.numero).padStart(4, '0')}`;
    }
    return ticket.id ?? '—';
  }

  getCreationDate(ticket: Ticket): Date | null {
    const value = ticket.fechaCreacion;
    if (value instanceof Date) {
      return value;
    }
    return value instanceof Timestamp ? value.toDate() : null;
  }

  getStatusLabel(status: Ticket['estado']): string {
    const labels: Record<Ticket['estado'], string> = {
      abierto: 'Abierto',
      'en proceso': 'En proceso',
      cerrado: 'Resuelto'
    };
    return labels[status];
  }

  getStatusClass(ticket: Ticket): string {
    return `status-${this.getTicketDisplayStatus(ticket).replace(/\s+/g, '-')}`;
  }

  getPriorityLabel(priority: TicketPriority): string {
    const labels: Record<TicketPriority, string> = {
      urgente: 'Urgente',
      alta: 'Alta',
      media: 'Media',
      baja: 'Baja'
    };
    return labels[priority];
  }

  getPriorityClass(priority: TicketPriority): string {
    return `priority-${priority}`;
  }

  /** Exporta los resultados filtrados en un archivo CSV compatible con hojas de cálculo. */
  exportTickets(): void {
    const headers = ['ID', 'Título', 'Solicitante', 'Categoría', 'Prioridad', 'Estado', 'Fecha'];
    const rows = this.filteredTickets.map((ticket) => [
      this.getTicketNumber(ticket),
      ticket.titulo,
      ticket.clienteNombre,
      ticket.categoria,
      this.getPriorityLabel(ticket.prioridad),
      this.getStatusLabel(ticket.estado),
      this.getCreationDate(ticket)?.toLocaleString('es-MX') ?? ''
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const file = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
    const fileUrl = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = this.userRole === 'technician' ? 'tickets-asignados.csv' : 'tickets-del-sistema.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private async withTimeout<T>(operation: Promise<T>, message: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        operation,
        new Promise<T>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(message)), DASHBOARD_LOAD_TIMEOUT_MS);
        })
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
