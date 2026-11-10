# TicketDesk - Sistema de Gestión de Incidencias

TicketDesk es una plataforma centralizada de soporte interno diseñada para resolver incidencias corporativas de manera ágil y clara.

## 🚀 Características Principales
- **Autenticación Corporativa**: Acceso seguro mediante Firebase Auth.
- **Gestión de Tickets**: Operaciones completas de creación, lectura, actualización y eliminación (CRUD).
- **Diseño Moderno**: Interfaz responsiva construida con Angular y Tailwind CSS.
- **Almacenamiento en Tiempo Real**: Integración con Firebase Firestore para datos persistentes y actualizados.

## 🛠️ Tecnologías Utilizadas
- **Frontend**: Angular 22
- **Estilos**: Tailwind CSS 3
- **Backend/DB**: Firebase (Auth & Firestore)
- **Iconografía**: Google Material Symbols

## ⚙️ Instalación y Ejecución

### Requisitos Previos
- Node.js (versión compatible con Angular 22)
- npm

### Pasos para ejecutar localmente
1. Clona el repositorio.
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia el servidor de desarrollo:
   ```bash
   npm run start
   ```
4. Abre tu navegador en `http://localhost:4200/`.

## 📁 Estructura del Proyecto
- `src/app/core`: Configuraciones globales y servicios base (ej. `firebase.config.ts`).
- `src/app/layouts`: Contenedores compartidos de las secciones autenticadas (ej. navegación y barra superior).
- `src/app/models`: Definiciones de interfaces y tipos de datos (ej. `ticket.ts`).
- `src/app/services`: Lógica de negocio y comunicación con la API/DB (ej. `tickets.ts`).
- `src/app/pages`: Componentes de vista y pantallas de la aplicación.

## 🎫 Crear Tickets
- El formulario vive en `src/app/pages/new-ticket` y guarda los datos del ticket en la colección `tickets` de Firestore.
- Los adjuntos opcionales (PDF, PNG/JPG/HEIC, LOG y TXT) se suben a Firebase Storage; el límite combinado por ticket es 25 MB.
- En la sección Usuarios, un administrador puede asignar los roles `user`, `technician` y `admin`. Al asignar o retirar el rol técnico, se sincroniza una ficha mínima (nombre y departamento) en `technicianDirectory` para el selector de asignación.
- Las reglas locales de Firestore y Storage están en `firestore.rules` y `storage.rules`; revísalas y pruébalas antes de desplegarlas, ya que el despliegue puede reemplazar las reglas activas del proyecto.

## 👥 Administración de usuarios
- Las operaciones de alta, consulta, edición y baja de cuentas se ejecutan mediante Firebase Cloud Functions en `functions/`, usando Firebase Admin SDK para sincronizar Authentication, Firestore y el directorio técnico.
- Las funciones comprueban en el servidor que la cuenta invocadora tenga `role: "admin"` en `users/{uid}`. No asignes este rol desde el formulario de registro público.
- Para preparar las funciones, instala Node.js 20 y Firebase CLI, configura el proyecto Firebase y ejecuta `npm install --prefix functions`. Después de revisar la configuración, despliega únicamente las funciones con `firebase deploy --only functions`.
- El despliegue de Cloud Functions puede requerir el plan Blaze de Firebase. La aplicación no podrá crear, modificar o eliminar cuentas hasta que las funciones estén desplegadas en la región `us-central1`.
- El despliegue de reglas es separado: ejecuta `firebase deploy --only firestore:rules,storage` únicamente después de verificar que las políticas coincidan con los flujos de tickets y adjuntos de tu aplicación.

## 📝 Nota sobre el Desarrollo
Todo el código ha sido documentado siguiendo el estándar JSDoc para facilitar el mantenimiento y la escalabilidad del sistema.
