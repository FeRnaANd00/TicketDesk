import { Injectable } from '@angular/core';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../core/firebase.config';

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

/** Campos de perfil y autenticación requeridos para crear una cuenta. */
export interface CreateManagedUserRequest {
  email: string;
  password: string;
  username: string;
  department: string;
  phone: string;
  role: ManagedUserRole;
}

/** Campos editables de una cuenta ya registrada. */
export interface UpdateManagedUserRequest {
  uid: string;
  username: string;
  department: string;
  phone: string;
  role: ManagedUserRole;
}

/** Servicio de acceso a las operaciones administrativas confiables de Firebase. */
@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  /** Instancia callable de Functions vinculada al proyecto de la aplicación. */
  private readonly functions = getFunctions(app, 'us-central1');

  /** Solicita al backend la lista de cuentas después de verificar administrador. */
  async list(): Promise<ManagedUser[]> {
    const operation = httpsCallable<void, { users: ManagedUser[] }>(
      this.functions,
      'adminListUsers'
    );
    const result = await operation();
    return result.data.users;
  }

  /** Crea en Authentication y Firestore una cuenta y su perfil inicial. */
  async create(user: CreateManagedUserRequest): Promise<void> {
    const operation = httpsCallable<CreateManagedUserRequest, { uid: string }>(
      this.functions,
      'adminCreateUser'
    );
    await operation(user);
  }

  /** Actualiza el perfil y la asignación de rol desde el entorno confiable. */
  async update(user: UpdateManagedUserRequest): Promise<void> {
    const operation = httpsCallable<UpdateManagedUserRequest, { success: boolean }>(
      this.functions,
      'adminUpdateUser'
    );
    await operation(user);
  }

  /** Elimina la cuenta de Authentication y su ficha de usuario. */
  async delete(uid: string): Promise<void> {
    const operation = httpsCallable<{ uid: string }, { success: boolean }>(
      this.functions,
      'adminDeleteUser'
    );
    await operation({ uid });
  }
}
