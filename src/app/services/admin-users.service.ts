import { Injectable } from '@angular/core';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../core/firebase.config';

/** Roles que el administrador puede asignar a una cuenta. */
export type ManagedUserRole = 'admin' | 'technician' | 'user';

/** Perfil que la pantalla administrativa puede consultar y actualizar. */
export interface ManagedUser {
  uid: string;
  email: string;
  username: string;
  department: string;
  phone: string;
  role: ManagedUserRole;
}

/** Servicio de cambios de rol y sincronización del catálogo de técnicos. */
@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  /** Actualiza el rol de una cuenta y sincroniza su ficha técnica en una sola operación. */
  async updateRole(user: Pick<ManagedUser, 'uid' | 'username' | 'department' | 'role'>): Promise<void> {
    const batch = writeBatch(db);
    const userReference = doc(db, 'users', user.uid);
    const technicianReference = doc(db, 'technicianDirectory', user.uid);

    batch.update(userReference, { role: user.role });

    if (user.role === 'technician') {
      batch.set(technicianReference, {
        uid: user.uid,
        username: user.username,
        department: user.department
      });
    } else {
      batch.delete(technicianReference);
    }

    await batch.commit();
  }
}
