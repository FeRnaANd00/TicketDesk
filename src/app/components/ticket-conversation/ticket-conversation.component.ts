import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../core/firebase.config';
import { Ticket } from '../../models/ticket';
import { NewTicketMessage, TicketMessage, TicketMessageType } from '../../models/ticket-message';
import { TicketsService } from '../../services/tickets';

type ConversationRole = TicketMessage['authorRole'];

/** Presenta y conserva en tiempo real la conversación de un ticket. */
@Component({
  selector: 'app-ticket-conversation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ticket-conversation.component.html',
  styleUrl: './ticket-conversation.component.css'
})
export class TicketConversationComponent implements OnDestroy, OnInit {
  /** Ticket cuyo título, descripción y conversación se muestran. */
  @Input({ required: true }) ticket!: Ticket;
  /** Notifica al padre que el diálogo de conversación se cerró. */
  @Output() closed = new EventEmitter<void>();
  /** Actualiza la vista del padre cuando se cerró el ticket desde el compositor. */
  @Output() resolved = new EventEmitter<void>();
  /** Referencia al historial para desplazarlo al mensaje más reciente. */
  @ViewChild('messagesList') private messagesList?: ElementRef<HTMLDivElement>;

  /** Historial ordenado de mensajes y soluciones guardados para el ticket. */
  messages: TicketMessage[] = [];
  /** Texto que se enviará como comentario o solución. */
  draft = '';
  /** Mensaje propio que se está editando y su borrador local. */
  editingMessageId: string | null = null;
  editDraft = '';
  /** Estados de carga, envío y mensajes visibles para la persona usuaria. */
  isLoading = true;
  isSending = false;
  isSavingEdit = false;
  loadError = '';
  sendError = '';
  sendStatus = '';
  editError = '';
  /** Identidad verificada del autor actual, usada en los mensajes nuevos. */
  currentUserId = '';
  currentUserName = '';
  currentUserRole: ConversationRole | null = null;
  /** Límite compartido con las reglas de validación de Firestore. */
  readonly messageLimit = 4000;
  private unsubscribeMessages?: () => void;

  /** Recibe el servicio de tickets y el detector para reflejar respuestas en vivo. */
  constructor(
    private ticketsService: TicketsService,
    private changeDetector: ChangeDetectorRef
  ) {}

  /** Valida al participante actual y se suscribe al historial del ticket. */
  async ngOnInit(): Promise<void> {
    try {
      await auth.authStateReady();
      const user = auth.currentUser;
      if (!user || !this.ticket.id) {
        throw new Error('No se pudo identificar la sesión o el ticket.');
      }

      const profile = await getDoc(doc(db, 'users', user.uid));
      const profileData = profile.data();
      const role = profileData?.['role'];
      if (role !== 'admin' && role !== 'technician' && role !== 'user') {
        throw new Error('No pudimos verificar tu perfil para abrir la conversación.');
      }

      this.currentUserId = user.uid;
      this.currentUserRole = role;
      this.currentUserName = this.readString(profileData?.['username']);
      if (!this.currentUserName) {
        throw new Error('Tu perfil necesita un nombre para participar en la conversación.');
      }

      if (!this.isParticipant) {
        throw new Error('Solo el solicitante, el técnico asignado y los administradores pueden ver esta conversación.');
      }

      this.unsubscribeMessages = this.ticketsService.escucharMensajes(
        this.ticket.id,
        messages => {
          const shouldScroll = this.isNearBottom();
          this.messages = messages;
          this.isLoading = false;
          this.loadError = '';
          this.changeDetector.markForCheck();
          if (shouldScroll) {
            setTimeout(() => this.scrollToLatestMessage(), 0);
          }
        },
        error => {
          console.error('Error al escuchar los mensajes del ticket:', error);
          this.loadError = 'No se pudo cargar la conversación. Revisa los permisos y tu conexión.';
          this.isLoading = false;
          this.changeDetector.markForCheck();
        }
      );
    } catch (error) {
      console.error('Error al abrir la conversación del ticket:', error);
      this.loadError = error instanceof Error && error.message.trim()
        ? error.message
        : 'No se pudo abrir la conversación.';
      this.isLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  /** Libera la suscripción al cerrar o destruir el diálogo. */
  ngOnDestroy(): void {
    this.unsubscribeMessages?.();
  }

  /** Solo el solicitante, el técnico asignado o un administrador participan. */
  get isParticipant(): boolean {
    return this.currentUserRole === 'admin'
      || this.ticket.clienteId === this.currentUserId
      || (this.currentUserRole === 'technician'
        && this.ticket.tecnicoAsignadoId === this.currentUserId);
  }

  /** Solo soporte puede marcar una intervención como solución. */
  get canSendSolution(): boolean {
    return this.currentUserRole === 'admin'
      || (this.currentUserRole === 'technician'
        && this.ticket.tecnicoAsignadoId === this.currentUserId);
  }

  /** Conserva el historial visible y bloquea cambios de no administradores al cerrar el ticket. */
  get isReadOnly(): boolean {
    return this.ticket.estado === 'cerrado' && this.currentUserRole !== 'admin';
  }

  /** Solo permite editar los mensajes publicados por la persona autenticada. */
  canEditMessage(message: TicketMessage): boolean {
    return this.isParticipant
      && Boolean(this.currentUserId)
      && message.authorId === this.currentUserId;
  }

  /** Copia el texto propio al editor sin alterar el mensaje guardado. */
  startEditingMessage(message: TicketMessage): void {
    if (!this.canEditMessage(message) || this.isReadOnly
      || this.isSavingEdit || this.editingMessageId !== null) {
      return;
    }

    this.editingMessageId = message.id;
    this.editDraft = message.text;
    this.editError = '';
  }

  /** Descarta el borrador local de edición. */
  cancelEditingMessage(): void {
    if (this.isSavingEdit) {
      return;
    }

    this.editingMessageId = null;
    this.editDraft = '';
    this.editError = '';
  }

  /** Guarda únicamente el texto de un mensaje propio; el servidor valida la autoría. */
  async saveMessageEdit(message: TicketMessage): Promise<void> {
    const text = this.editDraft.trim();
    if (!this.ticket.id || message.id !== this.editingMessageId
      || !this.canEditMessage(message) || this.isReadOnly || !text || text.length > this.messageLimit
      || this.isSavingEdit) {
      return;
    }

    if (text === message.text) {
      this.cancelEditingMessage();
      return;
    }

    this.isSavingEdit = true;
    this.editError = '';
    try {
      await this.ticketsService.editarMensaje(this.ticket.id, message.id, text);
      this.editingMessageId = null;
      this.editDraft = '';
    } catch (error) {
      console.error('Error al editar un mensaje del ticket:', error);
      this.editError = 'No se pudo actualizar el mensaje. Inténtalo de nuevo.';
    } finally {
      this.isSavingEdit = false;
      this.changeDetector.markForCheck();
    }
  }

  /** Publica un mensaje o solución y cierra el ticket atómicamente si es una solución. */
  async sendMessage(type: TicketMessageType): Promise<void> {
    const text = this.draft.trim();
    if (!text || text.length > this.messageLimit || !this.ticket.id
      || !this.currentUserId || !this.currentUserRole || this.isSending || !this.isParticipant
      || this.isReadOnly || (type === 'solution' && !this.canSendSolution)) {
      return;
    }

    const resolveTicket = type === 'solution';
    this.sendError = '';
    this.sendStatus = '';
    this.isSending = true;
    const message: NewTicketMessage = {
      text,
      authorId: this.currentUserId,
      authorName: this.currentUserName,
      authorRole: this.currentUserRole,
      type
    };

    try {
      await this.ticketsService.agregarMensaje(
        this.ticket.id,
        message
      );
      this.draft = '';
      this.sendStatus = resolveTicket
        ? 'Solución enviada y ticket cerrado.'
        : 'Mensaje enviado.';
      if (resolveTicket) {
        this.resolved.emit();
      }
    } catch (error) {
      console.error('Error al enviar un mensaje del ticket:', error);
      this.sendError = 'No se pudo enviar el mensaje. Inténtalo de nuevo.';
    } finally {
      this.isSending = false;
      this.changeDetector.markForCheck();
    }
  }

  /** Cierra la ventana y permite volver al detalle del ticket. */
  close(): void {
    this.closed.emit();
  }

  /** Cierra la ventana de conversación con Escape. */
  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.close();
  }

  /** Crea el avatar de iniciales que identifica a cada autor del chat. */
  getInitials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0))
      .join('')
      .toLocaleUpperCase('es');
  }

  /** Mantiene el mismo identificador TKD visible en el resto de la aplicación. */
  getTicketNumber(): string {
    if (typeof this.ticket.numero === 'number' && Number.isSafeInteger(this.ticket.numero)
      && this.ticket.numero > 0) {
      return `TKD-${String(this.ticket.numero).padStart(4, '0')}`;
    }
    return this.ticket.id ?? '—';
  }

  /** Traduce el estado del modelo a las etiquetas resumidas de la ficha. */
  getTicketStatusLabel(): string {
    if (this.ticket.estado === 'cerrado') {
      return 'Caso resuelto';
    }

    return this.ticket.estado === 'en proceso' || Boolean(this.ticket.tecnicoAsignadoId)
      ? 'Asignado'
      : 'Nuevo';
  }

  /** Devuelve un tono acotado para el estado y evita clases derivadas de texto arbitrario. */
  getTicketStatusTone(): 'closed' | 'assigned' | 'new' {
    if (this.ticket.estado === 'cerrado') {
      return 'closed';
    }

    return this.ticket.estado === 'en proceso' || Boolean(this.ticket.tecnicoAsignadoId)
      ? 'assigned'
      : 'new';
  }

  /** Muestra el estado persistido sin asumir una fecha o un autor de cierre. */
  getTicketStatusDetail(): string {
    if (this.ticket.estado === 'cerrado') {
      return 'Cerrado';
    }

    return this.ticket.estado === 'en proceso' ? 'En proceso' : 'Abierto';
  }

  /** Convierte la prioridad persistida a una etiqueta legible. */
  getPriorityLabel(): string {
    const labels: Record<Ticket['prioridad'], string> = {
      baja: 'Prioridad Baja',
      media: 'Prioridad Media',
      alta: 'Prioridad Alta',
      urgente: 'Prioridad Urgente'
    };
    return labels[this.ticket.prioridad];
  }

  /** Obtiene la fecha inicial cuando Firestore ya la ha resuelto a Date o Timestamp. */
  getTicketCreationDate(): Date | null {
    const date = this.ticket.fechaCreacion;
    if (date instanceof Date) {
      return date;
    }
    return date instanceof Timestamp ? date.toDate() : null;
  }

  /** Traduce el rol persistido del autor a una etiqueta visible. */
  getRoleLabel(role: ConversationRole): string {
    const labels: Record<ConversationRole, string> = {
      admin: 'Administrador',
      technician: 'Técnico',
      user: 'Solicitante'
    };
    return labels[role];
  }

  /** Convierte timestamps de Firestore para mostrarlos con el pipe de fecha. */
  getMessageDate(message: TicketMessage): Date | null {
    const date = message.createdAt;
    if (date instanceof Date) {
      return date;
    }
    return date instanceof Timestamp ? date.toDate() : null;
  }

  /** Conserva cada mensaje de la lista mediante su ID estable de Firestore. */
  trackByMessageId(index: number, message: TicketMessage): string | number {
    return message.id || index;
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private isNearBottom(): boolean {
    const element = this.messagesList?.nativeElement;
    return !element || element.scrollHeight - element.scrollTop - element.clientHeight < 80;
  }

  private scrollToLatestMessage(): void {
    const element = this.messagesList?.nativeElement;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }
}
