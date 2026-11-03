export type Prioridad = 'baja' | 'media' | 'alta' | 'urgente';
export type Estado = 'abierto' | 'en_proceso' | 'resuelto' | 'cerrado';

export interface Ticket {
  id?: string;
  titulo: string;
  descripcion: string;
  prioridad: Prioridad;
  estado: Estado;
  categoria: string;
  creadoPor: string;
  asignadoA?: string;
  fechaCreacion: Date;
  fechaActualizacion: Date;
}