/**
 * Interfaz que representa un Ticket de soporte en el sistema.
 * Define la estructura de los datos que se almacenan en Firestore.
 */
export interface Ticket {
  /** Identificador único generado por Firestore. */
  id?: string;
  /** Título corto y descriptivo de la incidencia. */
  titulo: string;
  /** Descripción detallada del problema reportado. */
  descripcion: string;
  /** Estado actual del ticket. */
  estado: 'abierto' | 'en proceso' | 'cerrado';
  /** Nivel de urgencia asignado al ticket. */
  prioridad: 'baja' | 'media' | 'alta';
  /** Fecha y hora de creación del ticket (Timestamp de Firestore o Date). */
  fechaCreacion: any;
  /** ID del cliente que reportó la incidencia. */
  clienteId?: string;
  /** Nombre legible del cliente para visualización rápida. */
  clienteNombre?: string;
}
