import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { deleteObject, ref, uploadBytes, StorageReference } from 'firebase/storage';
import { auth, db, storage } from '../../core/firebase.config';
import {
  Ticket,
  TicketAttachment,
  TicketCategory,
  TicketPriority
} from '../../models/ticket';
import { TicketsService } from '../../services/tickets';

/** Límite acumulado de todos los archivos seleccionados en un ticket. */
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

/** Representa un técnico disponible para recibir tickets. */
interface TechnicianOption {
  uid: string;
  username: string;
  department: string;
}

/** Conserva el archivo seleccionado junto con su vista previa temporal. */
interface PendingAttachment {
  file: File;
  previewUrl: string;
}

/** Componente de formulario para crear tickets y cargar sus archivos adjuntos. */
@Component({
  selector: 'app-new-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './new-ticket.component.html',
  styleUrl: './new-ticket.component.css'
})
export class NewTicketComponent implements OnInit, OnDestroy {
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
  /** Archivos seleccionados y sus vistas previas temporales. */
  attachments: PendingAttachment[] = [];
  /** Indica que se están cargando los perfiles técnicos. */
  isLoadingTechnicians = true;
  /** Indica que el formulario está guardando el ticket o sus archivos. */
  isSubmitting = false;
  /** Estado visual de arrastre de archivos sobre el área de carga. */
  isDragOver = false;
  /** Mensaje accesible cuando ocurre un problema al cargar técnicos. */
  technicianLoadError = '';
  /** Mensajes de validación o guardado visibles junto al formulario. */
  formError = '';
  /** Identificador mostrado al confirmar que el ticket fue guardado. */
  createdTicketId = '';
  /** Nombre de la persona que solicita el ticket, obtenido de su perfil. */
  private requesterName = 'Usuario';
  /** Referencias de Storage para limpiar archivos si el envío falla. */
  private uploadedStorageReferences: StorageReference[] = [];

  /** Recibe la navegación y el servicio centralizado de tickets. */
  constructor(
    private router: Router,
    private ticketsService: TicketsService
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

  /** Libera las vistas previas temporales al abandonar el formulario. */
  ngOnDestroy(): void {
    this.revokeAttachmentPreviews();
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
    } catch (error) {
      console.error('Error al cargar los técnicos disponibles:', error);
      this.technicianLoadError = 'No se pudo cargar la lista de técnicos.';
    } finally {
      this.isLoadingTechnicians = false;
    }
  }

  /** Actualiza la prioridad marcada por la persona que reporta la incidencia. */
  selectPriority(priority: TicketPriority): void {
    this.priority = priority;
  }

  /** Recibe archivos del selector y reinicia el control para admitir repetidos. */
  onFilesSelected(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.files) {
      return;
    }

    this.addFiles(Array.from(input.files));
    input.value = '';
  }

  /** Habilita la zona de carga cuando se arrastran archivos sobre ella. */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  /** Restablece el estilo de la zona cuando el puntero deja de arrastrar. */
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  /** Agrega al formulario los archivos soltados sobre el área de carga. */
  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    if (event.dataTransfer?.files) {
      this.addFiles(Array.from(event.dataTransfer.files));
    }
  }

  /** Valida el tipo y el límite total antes de conservar los archivos elegidos. */
  private addFiles(files: File[]): void {
    this.formError = '';
    const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'heic', 'heif', 'log', 'txt'];
    const isAllowed = files.every((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      return allowedExtensions.includes(extension);
    });

    if (!isAllowed) {
      this.formError = 'Solo se permiten archivos PDF, imágenes PNG/JPG/HEIC y archivos LOG o TXT.';
      return;
    }

    const currentSize = this.attachments.reduce((total, item) => total + item.file.size, 0);
    const incomingSize = files.reduce((total, file) => total + file.size, 0);
    if (currentSize + incomingSize > MAX_ATTACHMENT_SIZE) {
      this.formError = 'El tamaño combinado de los archivos no puede superar 25 MB.';
      return;
    }

    this.attachments = [
      ...this.attachments,
      ...files.map((file) => ({
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
      }))
    ];
  }

  /** Quita un archivo seleccionado y libera su URL de vista previa. */
  removeAttachment(index: number): void {
    const [removed] = this.attachments.splice(index, 1);
    if (removed?.previewUrl) {
      URL.revokeObjectURL(removed.previewUrl);
    }
    this.attachments = [...this.attachments];
  }

  /** Devuelve el tamaño seleccionado en una unidad legible para la pantalla. */
  get attachmentSizeLabel(): string {
    const total = this.attachments.reduce((size, item) => size + item.file.size, 0);
    return `${(total / (1024 * 1024)).toFixed(1)} MB de 25 MB`;
  }

  /** Comprueba el formulario y guarda el ticket con sus adjuntos opcionales. */
  async submitTicket(form: NgForm): Promise<void> {
    this.formError = '';
    this.createdTicketId = '';
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
    this.uploadedStorageReferences = [];
    let createdTicketId = '';

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

      createdTicketId = await this.ticketsService.crear(ticket);
      const uploadedAttachments = await this.uploadAttachments(user.uid, createdTicketId);
      if (uploadedAttachments.length > 0) {
        await setDoc(
          doc(db, 'tickets', createdTicketId),
          { adjuntos: uploadedAttachments },
          { merge: true }
        );
      }

      this.createdTicketId = createdTicketId;
      this.title = '';
      this.category = '';
      this.priority = 'media';
      this.description = '';
      this.selectedTechnicianId = '';
      this.revokeAttachmentPreviews();
      form.resetForm();
    } catch (error) {
      console.error('Error al crear el ticket:', error);
      await this.cleanupFailedSubmission(createdTicketId);
      this.formError = 'No se pudo enviar el ticket. Revisa la conexión y los permisos de Firebase e inténtalo de nuevo.';
    } finally {
      this.isSubmitting = false;
      this.uploadedStorageReferences = [];
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

  /** Sube los archivos y devuelve sus metadatos para guardarlos en Firestore. */
  private async uploadAttachments(
    uid: string,
    ticketId: string
  ): Promise<TicketAttachment[]> {
    const uploaded: TicketAttachment[] = [];

    for (const [index, attachment] of this.attachments.entries()) {
      const safeName = attachment.file.name.replace(/[\\/#?]/g, '_');
      const path = `tickets/${uid}/${ticketId}/${index}-${safeName}`;
      const storageReference = ref(storage, path);

      await uploadBytes(storageReference, attachment.file, {
        contentType: attachment.file.type || 'application/octet-stream'
      });
      this.uploadedStorageReferences.push(storageReference);

      uploaded.push({
        nombre: attachment.file.name,
        tipo: attachment.file.type || 'application/octet-stream',
        tamano: attachment.file.size,
        ruta: path
      });
    }

    return uploaded;
  }

  /** Elimina archivos y documento creados si falla una parte del envío. */
  private async cleanupFailedSubmission(ticketId: string): Promise<void> {
    const cleanupResults = await Promise.allSettled(
      this.uploadedStorageReferences.map((storageReference) => deleteObject(storageReference))
    );
    cleanupResults
      .filter((result) => result.status === 'rejected')
      .forEach((result) => console.error('No se pudo limpiar un archivo temporal:', result.reason));

    if (ticketId) {
      try {
        await this.ticketsService.eliminar(ticketId);
      } catch (error) {
        console.error('No se pudo limpiar el ticket incompleto:', error);
      }
    }
  }

  /** Cancela la captura y regresa al área de tickets. */
  cancel(): void {
    void this.router.navigate(['/tickets']);
  }

  /** Libera las URLs locales que representan las imágenes seleccionadas. */
  private revokeAttachmentPreviews(): void {
    this.attachments.forEach((attachment) => {
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    });
    this.attachments = [];
  }
}
