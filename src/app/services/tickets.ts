import { Injectable } from '@angular/core';
import { db } from '../core/firebase.config';
import { Ticket } from '../models/ticket';
import { 
  collection, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy 
} from 'firebase/firestore';

/**
 * Servicio encargado de gestionar todas las operaciones CRUD de los tickets
 * interactuando directamente con la base de datos de Firebase Firestore.
 */
@Injectable({ providedIn: 'root' })
export class TicketsService {
  /** Nombre de la colección en Firestore donde se almacenan los tickets. */
  private collectionName = 'tickets';

  /**
   * Obtiene la lista de todos los tickets ordenados por fecha de creación (más recientes primero).
   * @returns Promesa con un arreglo de objetos Ticket.
   */
  async listar(): Promise<Ticket[]> {
    const q = query(collection(db, this.collectionName), orderBy('fechaCreacion', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket));
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
   * @returns Promesa con el ID del ticket creado.
   */
  async crear(ticket: Ticket): Promise<string> {
    const docRef = await addDoc(collection(db, this.collectionName), ticket);
    return docRef.id;
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

  /**
   * Elimina un ticket de la base de datos permanentemente.
   * @param id El identificador del ticket a eliminar.
   * @returns Promesa que se resuelve cuando la eliminación es exitosa.
   */
  async eliminar(id: string): Promise<void> {
    await deleteDoc(doc(db, this.collectionName, id));
  }
}
