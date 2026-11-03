import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { db } from './app/core/firebase.config';
import { collection, addDoc } from 'firebase/firestore';

/**
 * Función asíncrona para validar la conexión con Firestore.
 * Intenta crear un documento en una colección temporal llamada 'test_conexion'.
 */
async function probarConexion() {
  try {
    await addDoc(collection(db, 'test_conexion'), {
      mensaje: '¡Conexión exitosa desde Angular!',
      fecha: new Date()
    });
    console.log('✅ CONEXIÓN EXITOSA: Se escribió un documento en Firebase');
  } catch (error) {
    console.error('❌ ERROR DE CONEXIÓN:', error);
  }
}

// Ejecutar la validación de conexión inmediatamente al iniciar la aplicación
probarConexion();

/**
 * Inicialización de la aplicación Angular
 */
bootstrapApplication(App, appConfig)
  .catch((err) => console.error('Error al iniciar la aplicación:', err));
