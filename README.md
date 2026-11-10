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

## 📝 Nota sobre el Desarrollo
Todo el código ha sido documentado siguiendo el estándar JSDoc para facilitar el mantenimiento y la escalabilidad del sistema.
