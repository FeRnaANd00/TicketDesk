import type { FieldValue, Timestamp } from 'firebase/firestore';

/** Niveles de prioridad permitidos al crear y gestionar tickets. */
export type TicketPriority = 'baja' | 'media' | 'alta' | 'urgente';

/** Categorías disponibles en el formulario de creación de tickets. */
export type TicketCategory =
  | 'Soporte Técnico'
  | 'Redes y comunicaciones'
  | 'Desarrollador de sistema';

/** Metadatos de un archivo guardado en Firebase Storage y asociado al ticket. */
export interface TicketAttachment {
  /** Nombre original del archivo seleccionado por el solicitante. */
  nombre: string;
  /** Tipo MIME usado para identificar el formato del archivo. */
  tipo: string;
  /** Tamaño del archivo expresado en bytes. */
  tamano: number;
  /** Ruta del objeto dentro de Firebase Storage. */
  ruta: string;
}

/** Estructura persistida en Firestore para un ticket de soporte. */
export interface Ticket {
  /** Identificador único generado por Firestore. */
  id?: string;
  /** Número secuencial global asignado al ticket al momento de crearlo. */
  numero?: number;
  /** Título corto y descriptivo de la incidencia. */
  titulo: string;
  /** Descripción detallada del problema reportado. */
  descripcion: string;
  /** Clasificación elegida en el formulario de creación. */
  categoria: TicketCategory;
  /** Estado actual del ticket. */
  estado: 'abierto' | 'en proceso' | 'cerrado';
  /** Nivel de urgencia asignado al ticket. */
  prioridad: TicketPriority;
  /** Fecha serializada de Firestore o marcador de tiempo del servidor al crear. */
  fechaCreacion: Date | Timestamp | FieldValue;
  /** ID del cliente que reportó la incidencia. */
  clienteId: string;
  /** Nombre legible del cliente para visualización rápida. */
  clienteNombre: string;
  /** UID del técnico asignado; se omite si el ticket queda sin asignar. */
  tecnicoAsignadoId?: string;
  /** Nombre visible del técnico seleccionado. */
  tecnicoAsignadoNombre?: string;
  /** Archivos opcionales subidos a Firebase Storage. */
  adjuntos: TicketAttachment[];
}
