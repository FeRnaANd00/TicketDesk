import { Injectable } from '@angular/core';
import { db } from '../core/firebase.config';
import { Ticket } from '../models/ticket';
import { 
  collection, 
  getDocs, 
  getDoc, 
  runTransaction,
  deleteField,
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where
} from 'firebase/firestore';

/** Resultado de crear un ticket, incluyendo su referencia y número visible. */
export interface CreatedTicket {
  /** Identificador interno del documento en Firestore. */
  id: string;
  /** Número secuencial global que se muestra como TKD-0001. */
  numero: number;
}

/** Campos editables por el equipo de soporte desde la pantalla de tickets. */
export interface TicketManagementChanges {
  /** Categoría vigente asignada a la incidencia. */
  categoria: Ticket['categoria'];
  /** Estado persistido de la incidencia. */
  estado: Ticket['estado'];
  /** UID del técnico elegido; vacío significa dejar el ticket sin asignar. */
  tecnicoAsignadoId: string;
  /** Nombre visible del técnico elegido; vacío cuando no hay asignación. */
  tecnicoAsignadoNombre: string;
}

/**
 * Servicio encargado de gestionar todas las operaciones CRUD de los tickets
 * interactuando directamente con la base de datos de Firebase Firestore.
 */
@Injectable({ providedIn: 'root' })
export class TicketsService {
  /** Nombre de la colección en Firestore donde se almacenan los tickets. */
  private collectionName = 'tickets';

  /** Obtiene únicamente los tickets creados por la persona autenticada. */
  async listarPropios(clienteId: string): Promise<Ticket[]> {
    const q = query(
      collection(db, this.collectionName),
      where('clienteId', '==', clienteId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(ticketDocument => ({ id: ticketDocument.id, ...ticketDocument.data() } as Ticket))
      .sort((first, second) => this.getCreationTime(second) - this.getCreationTime(first));
  }

  /**
   * Obtiene la información detallada de un ticket específico mediante su ID.
   * @param id El identificador único del ticket.
   * @returns Promesa con el Ticket encontrado o null si no existe.
   */
  async obtener(id: string): Promise<Ticket | null> {
    const docSnap = await getDoc(doc(db, this.collectionName, id));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Ticket : null;
  }

  /**
   * Crea un nuevo ticket en la base de datos.
   * @param ticket Objeto con los datos del nuevo ticket.
   * @returns Referencia interna y número secuencial asignado al ticket.
   */
  async crear(ticket: Omit<Ticket, 'id' | 'numero'>): Promise<CreatedTicket> {
    const ticketRef = doc(collection(db, this.collectionName));
    const counterRef = doc(db, 'ticketCounters', 'global');
    const numero = await runTransaction(db, async transaction => {
      const counterSnapshot = await transaction.get(counterRef);
      const lastNumber = counterSnapshot.exists()
        ? counterSnapshot.data()['lastNumber']
        : 0;

      if (!Number.isSafeInteger(lastNumber) || lastNumber < 0) {
        throw new Error('El contador global de tickets tiene un valor inválido.');
      }

      const nextNumber = lastNumber + 1;
      transaction.set(counterRef, {
        lastNumber: nextNumber,
        lastTicketId: ticketRef.id
      });
      transaction.set(ticketRef, { ...ticket, numero: nextNumber });
      return nextNumber;
    });

    return { id: ticketRef.id, numero };
  }

  /**
   * Actualiza parcialmente los datos de un ticket existente.
   * @param id El identificador del ticket a modificar.
   * @param cambios Objeto que contiene solo los campos a actualizar.
   * @returns Promesa que se resuelve cuando la actualización es exitosa.
   */
  async actualizar(id: string, cambios: Partial<Ticket>): Promise<void> {
    await updateDoc(doc(db, this.collectionName, id), cambios);
  }

  /** Actualiza exclusivamente categoría, estado y asignación del ticket. */
  async actualizarGestion(id: string, cambios: TicketManagementChanges): Promise<void> {
    const assignment = cambios.tecnicoAsignadoId
      ? {
          tecnicoAsignadoId: cambios.tecnicoAsignadoId,
          tecnicoAsignadoNombre: cambios.tecnicoAsignadoNombre
        }
      : {
          tecnicoAsignadoId: deleteField(),
          tecnicoAsignadoNombre: deleteField()
        };

    await updateDoc(doc(db, this.collectionName, id), {
      categoria: cambios.categoria,
      estado: cambios.estado,
      ...assignment
    });
  }

  /**
   * Elimina un ticket de la base de datos permanentemente.
   * @param id El identificador del ticket a eliminar.
   * @returns Promesa que se resuelve cuando la eliminación es exitosa.
   */
  async eliminar(id: string): Promise<void> {
    await deleteDoc(doc(db, this.collectionName, id));
  }

  /** Convierte las fechas de Firestore a milisegundos para ordenar la lista. */
  private getCreationTime(ticket: Ticket): number {
    const creationDate = ticket.fechaCreacion;
    if (creationDate instanceof Date) {
      return creationDate.getTime();
    }

    if (
      typeof creationDate === 'object'
      && creationDate !== null
      && 'toMillis' in creationDate
      && typeof creationDate.toMillis === 'function'
    ) {
      return creationDate.toMillis();
    }

    return 0;
  }
}
