import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { auth, db } from '../../core/firebase.config';
import { doc, getDoc } from 'firebase/firestore';

/**
 * =============================================================================
 * COMPONENTE: DashboardComponent (VERSION BLINDADA)
 * =============================================================================
 * Esta versión elimina cualquier retraso asíncrono en el modo seguro y utiliza
 * ChangeDetectorRef para obligar al navegador a renderizar la interfaz.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  
  /** MODO EMERGENCIA: Saltamos Firebase y forzamos la vista de Admin */
  private readonly BYPASS_FIREBASE = true; 

  /** 
   * ESTADOS INICIALES
   * Inicializamos isLoading en FALSE para evitar que el spinner sea lo primero que se vea
   * si el sistema va a entrar en modo bypass.
   */
  username: string = 'Cargando...';
  userRole: string | null = null;
  isLoading = false; 
  hasError = false;

  /** Inyecta detección de cambios para actualizar la vista tras cargar los datos. */
  constructor(private cdr: ChangeDetectorRef) {}

  async ngOnInit() {
    console.log('🚀 [Dashboard] Ejecutando ngOnInit...');
    await this.loadUserProfile();
  }

  async loadUserProfile() {
    console.log('🔍 [Dashboard] Iniciando proceso de carga...');

    if (this.BYPASS_FIREBASE) {
      console.log('⚠️ [Dashboard] BYPASS ACTIVO: Forzando vista de Administrador...');
      
      // Asignación instantánea de valores
      this.username = 'Usuario Admin (Debug)';
      this.userRole = 'admin';
      this.isLoading = false;
      this.hasError = false;

      // FORZADO DE VISTA: Obligamos a Angular a actualizar el HTML inmediatamente
      this.cdr.detectChanges(); 
      
      console.log('✅ [Dashboard] Vista de Administrador forzada exitosamente.');
      return;
    }

    // Lógica normal para cuando el BYPASS esté en false
    this.isLoading = true;
    this.hasError = false;

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 8000)
    );

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No auth');

      const userDoc = await Promise.race([
        getDoc(doc(db, 'users', user.uid)),
        timeoutPromise
      ]) as any; 
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        this.username = userData?.['username'] || 'Usuario';
        this.userRole = userData?.['role'] || 'user';
      } else {
        this.username = 'Usuario';
        this.userRole = 'user';
      }
    } catch (error) {
      console.error('❌ [Dashboard] Error:', error);
      this.hasError = true; 
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges(); // Forzamos la actualización final
    }
  }

}