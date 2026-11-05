import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { auth, db } from '../../core/firebase.config';
import { doc, getDoc } from 'firebase/firestore';

/**
 * =============================================================================
 * COMPONENTE: DashboardComponent (VERSION DE EMERGENCIA / DEBUG)
 * =============================================================================
 * Esta versión incluye un modo de bypass para saltar el bloqueo de red
 * y permitir la visualización de la interfaz independientemente de Firebase.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  
  /** 
   * CONFIGURACIÓN DE EMERGENCIA
   * Cambia esto a 'false' cuando la red esté solucionada.
   * 'true': Ignora Firebase y entra como Admin automáticamente.
   */
  private readonly BYPASS_FIREBASE = true; 

  username: string = '';
  userRole: string | null = null;
  isLoading = true;
  hasError = false;

  constructor() {}

  async ngOnInit() {
    console.log('🚀 [Dashboard] Iniciando componente...');
    await this.loadUserProfile();
  }

  async loadUserProfile() {
    console.log('🔍 [Dashboard] Intentando cargar perfil...');
    this.isLoading = true;
    this.hasError = false;

    // --- MODO SEGURO / BYPASS ---
    if (this.BYPASS_FIREBASE) {
      console.log('⚠️ [Dashboard] MODO SEGURO ACTIVO: Saltando Firebase...');
      setTimeout(() => {
        this.username = 'Usuario Admin (Debug)';
        this.userRole = 'admin';
        this.isLoading = false;
        console.log('✅ [Dashboard] Acceso forzado concedido.');
      }, 1000); // Simulamos una carga breve
      return;
    }
    // ----------------------------

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout: El servidor no responde a tiempo')), 8000)
    );

    try {
      console.log('📡 [Dashboard] Solicitando datos a Firestore...');
      const user = auth.currentUser;
      if (!user) throw new Error('No hay usuario autenticado');

      const userDoc = await Promise.race([
        getDoc(doc(db, 'users', user.uid)),
        timeoutPromise
      ]) as any; 
      
      console.log('📥 [Dashboard] Respuesta recibida de Firestore.');

      if (userDoc.exists()) {
        const userData = userDoc.data();
        this.username = userData?.['username'] || 'Usuario';
        this.userRole = userData?.['role'] || 'user';
      } else {
        console.warn('⚠️ [Dashboard] Usuario sin documento en Firestore.');
        this.username = 'Usuario';
        this.userRole = 'user';
      }
    } catch (error) {
      console.error('❌ [Dashboard] Error crítico:', error);
      this.hasError = true; 
    } finally {
      this.isLoading = false;
      console.log('🏁 [Dashboard] Proceso de carga finalizado.');
    }
  }
}