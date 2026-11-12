import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { collection, doc, getDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../core/firebase.config';
import {
  Ticket,
  TicketCategory,
  TicketPriority
} from '../../models/ticket';
import { TicketsService } from '../../services/tickets';

/** Identifica cuál de los menús personalizados está abierto. */
type TicketDropdown = 'category' | 'technician' | null;

/** Representa un técnico disponible para recibir tickets. */
interface TechnicianOption {
  uid: string;
  username: string;
  department: string;
}

/** Componente de formulario para crear tickets y asignarlos a técnicos disponibles. */
@Component({
  selector: 'app-new-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './new-ticket.component.html',
  styleUrl: './new-ticket.component.css'
})
export class NewTicketComponent implements OnInit {
  /** Título breve de la incidencia con el límite de caracteres del formulario. */
  title = '';
  /** Categoría seleccionada para clasificar el problema. */
  category: TicketCategory | '' = '';
  /** Prioridad inicial del ticket. */
  priority: TicketPriority = 'media';
  /** Descripción detallada escrita por la persona solicitante. */
  description = '';
  /** UID del técnico seleccionado; vacío significa que queda sin asignar. */
  selectedTechnicianId = '';
  /** Catálogo de categorías disponible en el formulario. */
  readonly categories: TicketCategory[] = [
    'Soporte Técnico',
    'Redes y comunicaciones',
    'Desarrollador de sistema'
  ];
  /** Catálogo y etiquetas visuales de los niveles de prioridad. */
  readonly priorities: Array<{
    value: TicketPriority;
    label: string;
    icon: string;
  }> = [
    { value: 'baja', label: 'Baja', icon: 'info' },
    { value: 'media', label: 'Media', icon: 'schedule' },
    { value: 'alta', label: 'Alta', icon: 'warning' },
    { value: 'urgente', label: 'Urgente', icon: 'local_fire_department' }
  ];
  /** Técnicos que el administrador habilitó para recibir tickets. */
  technicians: TechnicianOption[] = [];
  /** Indica que se están cargando los perfiles técnicos. */
  isLoadingTechnicians = true;
  /** Indica que el formulario está guardando el ticket o sus archivos. */
  isSubmitting = false;
  /** Menú personalizado abierto para categoría o técnico. */
  openDropdown: TicketDropdown = null;
  /** Mensaje accesible cuando ocurre un problema al cargar técnicos. */
  technicianLoadError = '';
  /** Mensajes de validación o guardado visibles junto al formulario. */
  formError = '';
  /** Número secuencial mostrado al confirmar que el ticket fue guardado. */
  createdTicketNumber = '';
  /** Nombre de la persona que solicita el ticket, obtenido de su perfil. */
  private requesterName = 'Usuario';
  /** Recibe la navegación y el servicio centralizado de tickets. */
  constructor(
    private router: Router,
    private ticketsService: TicketsService,
    private changeDetector: ChangeDetectorRef
  ) {}

  /** Espera Auth y carga la identidad solicitante y el directorio de técnicos. */
  async ngOnInit(): Promise<void> {
    await auth.authStateReady();
    const user = auth.currentUser;

    if (!user) {
      await this.router.navigate(['/login']);
      return;
    }

    this.requesterName = user.displayName?.trim() || user.email?.split('@')[0] || 'Usuario';
    await Promise.all([
      this.loadRequesterName(user.uid),
      this.loadTechnicians()
    ]);
  }

  /** Consulta el nombre de perfil que quedará guardado como solicitante. */
  private async loadRequesterName(uid: string): Promise<void> {
    try {
      const profile = await getDoc(doc(db, 'users', uid));
      const username = profile.data()?.['username'];
      if (typeof username === 'string' && username.trim()) {
        this.requesterName = username.trim();
      }
    } catch (error) {
      console.error('Error al cargar el nombre del solicitante:', error);
    }
  }

  /** Carga exclusivamente las fichas públicas de técnicos habilitados. */
  private async loadTechnicians(): Promise<void> {
    this.isLoadingTechnicians = true;
    this.technicianLoadError = '';

    try {
      const snapshot = await getDocs(collection(db, 'technicianDirectory'));
      this.technicians = snapshot.docs
        .map((technicianDocument) => {
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
      if (!this.technicians.some((technician) => technician.uid === this.selectedTechnicianId)) {
        this.selectedTechnicianId = '';
      }
    } catch (error) {
      console.error('Error al cargar los técnicos disponibles:', error);
      this.technicianLoadError = 'No se pudo cargar la lista de técnicos.';
    } finally {
      this.isLoadingTechnicians = false;
      this.changeDetector.markForCheck();
    }
  }

  /** Actualiza la prioridad marcada por la persona que reporta la incidencia. */
  selectPriority(priority: TicketPriority): void {
    this.priority = priority;
  }

  /** Alterna el menú personalizado para categoría o asignación técnica. */
  toggleDropdown(dropdown: Exclude<TicketDropdown, null>): void {
    this.openDropdown = this.openDropdown === dropdown ? null : dropdown;
  }

  /** Cierra ambos menús cuando se hace clic fuera de sus controles. */
  @HostListener('document:click', ['$event'])
  closeDropdownsOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.ticket-select-control')) {
      this.openDropdown = null;
    }
  }

  /** Cierra el menú activo cuando se presiona Escape. */
  @HostListener('document:keydown.escape')
  closeDropdownsOnEscape(): void {
    this.openDropdown = null;
  }

  /** Selecciona una categoría y cierra su menú. */
  selectCategory(category: TicketCategory): void {
    this.category = category;
    this.openDropdown = null;
  }

  /** Selecciona un técnico o limpia la asignación del ticket. */
  selectTechnician(uid: string): void {
    this.selectedTechnicianId = uid;
    this.openDropdown = null;
  }

  /** Devuelve la ficha del técnico actualmente elegido, si está disponible. */
  get selectedTechnician(): TechnicianOption | null {
    return this.technicians.find((technician) => technician.uid === this.selectedTechnicianId) ?? null;
  }

  /** Comprueba el formulario y guarda el ticket sin depender de almacenamiento de archivos. */
  async submitTicket(form: NgForm): Promise<void> {
    this.formError = '';
    this.createdTicketNumber = '';
    const category = this.category;

    if (!form.valid || !this.title.trim() || !category || !this.description.trim()) {
      form.control.markAllAsTouched();
      this.formError = 'Completa el título, la categoría, la prioridad y la descripción.';
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      await this.router.navigate(['/login']);
      return;
    }

    this.isSubmitting = true;
    let createdTicketDocumentId = '';

    try {
      const technician = await this.getSelectedTechnician();
      const ticket: Omit<Ticket, 'id'> = {
        titulo: this.title.trim(),
        categoria: category,
        descripcion: this.description.trim(),
        estado: 'abierto',
        prioridad: this.priority,
        fechaCreacion: serverTimestamp(),
        clienteId: user.uid,
        clienteNombre: this.requesterName,
        ...(technician
          ? {
              tecnicoAsignadoId: technician.uid,
              tecnicoAsignadoNombre: technician.username
            }
          : {}),
        adjuntos: []
      };

      const createdTicket = await this.ticketsService.crear(ticket);
      createdTicketDocumentId = createdTicket.id;

      this.createdTicketNumber = this.formatTicketNumber(createdTicket.numero);
      this.title = '';
      this.category = '';
      this.priority = 'media';
      this.description = '';
      this.selectedTechnicianId = '';
      this.openDropdown = null;
      form.resetForm();
    } catch (error) {
      console.error('Error al crear el ticket:', error);
      await this.cleanupFailedSubmission(createdTicketDocumentId);
      this.formError = 'No se pudo enviar el ticket. Revisa la conexión y los permisos de Firebase e inténtalo de nuevo.';
    } finally {
      this.isSubmitting = false;
    }
  }

  /** Obtiene la ficha actual del técnico elegido para evitar asignaciones obsoletas. */
  private async getSelectedTechnician(): Promise<TechnicianOption | null> {
    if (!this.selectedTechnicianId) {
      return null;
    }

    const technicianSnapshot = await getDoc(
      doc(db, 'technicianDirectory', this.selectedTechnicianId)
    );
    if (!technicianSnapshot.exists()) {
      throw new Error('El técnico seleccionado ya no está disponible.');
    }

    const technician = technicianSnapshot.data();
    return {
      uid: technicianSnapshot.id,
      username: typeof technician['username'] === 'string'
        ? technician['username']
        : 'Técnico',
      department: typeof technician['department'] === 'string'
        ? technician['department']
        : ''
    };
  }

  /** Elimina el documento del ticket si falla una operación posterior a su creación. */
  private async cleanupFailedSubmission(ticketId: string): Promise<void> {
    if (ticketId) {
      try {
        await this.ticketsService.eliminar(ticketId);
      } catch (error) {
        console.error('No se pudo limpiar el ticket incompleto:', error);
      }
    }
  }

  /** Da formato al número secuencial compartido por todos los perfiles. */
  private formatTicketNumber(numero: number): string {
    return `TKD-${String(numero).padStart(4, '0')}`;
  }

  /** Cancela la captura y regresa al área de tickets. */
  cancel(): void {
    void this.router.navigate(['/tickets']);
  }
}
