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
- La pantalla no permite adjuntar archivos ni tomar fotos; los tickets nuevos guardan `adjuntos: []` para conservar compatibilidad con el esquema actual.
- Cada ticket nuevo recibe en la misma transacción un número consecutivo global (`TKD-0001`, `TKD-0002`, ...). Los tickets guardados antes de introducir este contador conservan su identificador original.
- La pantalla `/tickets` consulta únicamente los tickets cuyo `clienteId` coincide con el UID autenticado. `Cerrado` refleja el estado `cerrado`; `Asignado` refleja un ticket con técnico o en proceso; los demás se muestran como `Nuevo`.
- Administradores y técnicos pueden editar categoría, estado y técnico asignado desde el detalle; las reglas de Firestore limitan la actualización a esos campos y validan que el técnico exista en `technicianDirectory`.
- El contador requiere las reglas adicionales de `ticketCounters` declaradas en `firestore.rules`. Revisa y publica las reglas después de cada cambio antes de habilitar en Firebase la creación y gestión de tickets.
- Si se habilitan adjuntos en el futuro, Firebase Storage es el servicio apropiado para archivos. Firestore no sustituye al almacenamiento de archivos: los documentos tienen un límite de 1 MiB y guardar binarios como texto puede aumentar consumo y costos. La disponibilidad y facturación de Storage dependen de la configuración actual del proyecto.
- En la sección Usuarios, un administrador puede asignar los roles `technician` y `admin` a otros perfiles desde Firestore. Al asignar el rol técnico, se sincroniza una ficha mínima (nombre y departamento) en `technicianDirectory` para el selector de asignación.
- Las reglas locales de Firestore y Storage están en `firestore.rules` y `storage.rules`; revísalas y pruébalas antes de desplegarlas, ya que el despliegue puede reemplazar las reglas activas del proyecto.

## 👥 Administración de usuarios
- La pantalla Usuarios permite asignar los roles `technician` y `admin` a otros perfiles mediante una escritura atómica en Firestore que sincroniza el directorio técnico.
- Las reglas de `firestore.rules` limitan los cambios de rol a administradores; no permiten cambiar el propio rol ni degradar perfiles que ya son administradores.
- La pantalla no crea ni elimina cuentas. Esas operaciones de Firebase Authentication requieren las Cloud Functions de `functions/`, cuyo despliegue puede requerir el plan Blaze.
- Para preparar las funciones, instala Node.js 20 y Firebase CLI, configura el proyecto Firebase y ejecuta `npm install --prefix functions`. Después de revisar la configuración, despliega únicamente las funciones con `firebase deploy --only functions`.
- Para publicar solo los cambios de autorización de Firestore, revisa las reglas y ejecuta `firebase deploy --only firestore:rules --project proyectoangular-314b2`. No despliegues Storage como parte de este cambio.

## 📝 Nota sobre el Desarrollo
Todo el código ha sido documentado siguiendo el estándar JSDoc para facilitar el mantenimiento y la escalabilidad del sistema.
