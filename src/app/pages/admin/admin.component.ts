import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { db } from '../../core/firebase.config';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

/**
 * Interface para representar un usuario en el sistema de gestión.
 * Utilizada para tipar la lista de usuarios en la vista de administración.
 */
interface UserProfile {
  uid: string;
  email: string;
  username: string;
  department: string;
  role: 'admin' | 'user';
}

/**
 * Componente de Administración.
 * Permite al administrador visualizar la lista de todos los usuarios registrados
 * y gestionar sus roles (promover a admin o degradar a usuario).
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  /** Lista de todos los usuarios recuperados de Firestore. */
  users: UserProfile[] = [];
  /** Estado de carga para mostrar un indicador mientras se obtienen los datos. */
  isLoading = false;

  /**
   * Método de ciclo de vida de Angular que se ejecuta al iniciar el componente.
   * Llama a la función para cargar los usuarios desde la base de datos.
   */
  async ngOnInit() {
    await this.loadUsers();
  }

  /**
   * Recupera la lista completa de usuarios desde la colección 'users' de Firestore.
   * Mapea los documentos recuperados al tipo UserProfile.
   */
  async loadUsers() {
    this.isLoading = true;
    try {
      const usersCollection = collection(db, 'users');
      const snapshot = await getDocs(usersCollection);
      this.users = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as UserProfile));
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      alert('Hubo un error al cargar la lista de usuarios.');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Cambia el rol de un usuario específico.
   * @param user El objeto del usuario cuyo rol se desea modificar.
   */
  async toggleRole(user: UserProfile) {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    
    try {
      // Actualizamos únicamente el campo 'role' en el documento del usuario
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { role: newRole });
      
      // Actualizamos el estado local para reflejar el cambio inmediatamente en la UI
      user.role = newRole;
      
      alert(`El usuario ${user.username} ahora es ${newRole === 'admin' ? 'Administrador' : 'Usuario'}.`);
    } catch (error) {
      console.error('Error al actualizar el rol:', error);
      alert('No se pudo cambiar el rol del usuario.');
    }
  }
}
