import type { FieldValue, Timestamp } from 'firebase/firestore';

/** Separa una intervención normal de una respuesta marcada como solución. */
export type TicketMessageType = 'message' | 'solution';

/** Mensaje que forma parte de la conversación de un ticket. */
export interface TicketMessage {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorRole: 'admin' | 'technician' | 'user';
  type: TicketMessageType;
  createdAt: Date | Timestamp | FieldValue;
}

/** Campos aceptados al publicar un mensaje nuevo en la conversación. */
export type NewTicketMessage = Omit<TicketMessage, 'id' | 'createdAt'>;
