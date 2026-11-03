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

@Injectable({ providedIn: 'root' })
export class TicketsService {
  private collectionName = 'tickets';

  async listar(): Promise<Ticket[]> {
    const q = query(collection(db, this.collectionName), orderBy('fechaCreacion', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket));
  }

  async obtener(id: string): Promise<Ticket | null> {
    const docSnap = await getDoc(doc(db, this.collectionName, id));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Ticket : null;
  }

  async crear(ticket: Ticket): Promise<string> {
    const docRef = await addDoc(collection(db, this.collectionName), ticket);
    return docRef.id;
  }

  async actualizar(id: string, cambios: Partial<Ticket>): Promise<void> {
    await updateDoc(doc(db, this.collectionName, id), cambios);
  }

  async eliminar(id: string): Promise<void> {
    await deleteDoc(doc(db, this.collectionName, id));
  }
}