# TicketDesk — Sistema de gestión de incidencias

Mesa de ayuda interna: los usuarios reportan incidencias, los técnicos las atienden y los administradores gestionan el equipo. Está hecha con **Angular 22 + Tailwind CSS** y usa **Firebase** (Authentication + Firestore) como backend. No necesita servidor propio ni Cloud Functions, así que funciona en el plan gratuito *Spark*.

## Funcionalidades

| Rol | Puede |
|---|---|
| **Usuario** | Registrarse (correo o Google), crear tickets, ver los suyos, recategorizarlos o cerrarlos, y conversar con soporte. |
| **Técnico** | Todo lo anterior, más ver la cola completa, autoasignarse tickets abiertos, cambiar su estado y publicar **soluciones**, que cierran el ticket. Tiene acceso al Dashboard. |
| **Administrador** | Todo lo anterior sobre cualquier ticket, más asignar técnicos, eliminar tickets y cambiar roles (usuario ⇄ técnico, promover a admin). |

- Numeración secuencial global: `TKD-0001`, `TKD-0002`… El número se asigna en una transacción junto con el ticket.
- Conversación en tiempo real por ticket. Los mensajes editados quedan marcados como *Editado*.
- **Toda la seguridad vive en `firestore.rules`**. Los guards de Angular solo controlan la navegación, y las reglas tienen sus propios tests automatizados.

## Requisitos

- **Node.js 22 LTS o superior** (probado con Node 24) y npm.
- **Java 11+**: solo hace falta para el emulador de Firestore (`npm run test:rules` y `npm run emulators`).
- Un proyecto de Firebase propio. Si solo quieres verlo funcionando, puedes usar el proyecto que ya viene configurado.

La CLI de Firebase se instala como dependencia del proyecto y se usa con `npx firebase`. No hace falta instalarla globalmente.

## Puesta en marcha rápida

```bash
git clone <url-del-repo>
cd TicketDesk
npm ci          # instala exactamente las versiones del package-lock
npm start       # http://localhost:4200
```

Con esto la app se conecta al proyecto de Firebase configurado en `src/environments/environment.ts`.

## Usar tu propio proyecto de Firebase

1. En la [consola de Firebase](https://console.firebase.google.com/), crea un proyecto y añade una **app web**.
2. En **Authentication → Método de acceso**, habilita *Correo/contraseña* y, si quieres, *Google*.
3. Crea una base de datos de **Firestore** en modo producción.
4. Copia la configuración web de la app en `src/environments/environment.ts`.
5. Cambia el ID del proyecto en `.firebaserc`.
6. Inicia sesión en la CLI y publica las reglas:
   ```bash
   npx firebase login
   npm run deploy:rules
   ```
7. **Crea el primer administrador.** Regístrate en la app y completa tu perfil. Después, en la consola, abre *Firestore → `users` → tu documento* y cambia `role` de `user` a `admin`. Desde ese momento puedes gestionar los demás roles en la sección **Usuarios**.

> La `apiKey` de Firebase identifica al proyecto, no es un secreto. Aun así, en Google Cloud Console conviene restringirla a tus dominios.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm start` | Servidor de desarrollo en `http://localhost:4200`. |
| `npm run build` | Compilación de producción en `dist/ticketdesk/browser`. |
| `npm test` | Tests unitarios de Angular (Vitest). |
| `npm run test:rules` | Arranca el emulador de Firestore y ejecuta los tests de seguridad de `tests/`. |
| `npm run emulators` | Emuladores locales (Auth, Firestore, Hosting) con su interfaz web. |
| `npm run deploy:rules` | Publica solo las reglas e índices de Firestore. |
| `npm run deploy` | Compila y publica la app en Firebase Hosting junto con las reglas. |

## Estructura

```
firestore.rules            Reglas de seguridad (fuente de verdad de los permisos)
firestore.indexes.json     Índices de Firestore
tests/                     Tests de las reglas contra el emulador
src/app/
  core/                    Inicialización de Firebase
  models/                  Tipos: Ticket, TicketMessage
  services/                Acceso a Firestore (tickets, roles)
  layouts/                 Shell autenticado: cabecera y barra lateral
  pages/                   login, register, complete-profile, dashboard,
                           tickets, new-ticket, profile, admin (usuarios)
  components/              Conversación de un ticket
  *.guard.ts               auth (sesión), profile (perfil completo), role (rol)
```

## Modelo de datos (Firestore)

| Colección | Contenido |
|---|---|
| `users/{uid}` | Perfil: `username`, `department`, `phone`, `email`, `role` (`user` · `technician` · `admin`). |
| `technicianDirectory/{uid}` | Ficha pública mínima de cada técnico, usada en los selectores de asignación. Se sincroniza al cambiar roles. |
| `tickets/{id}` | `numero`, `titulo`, `descripcion`, `categoria`, `prioridad`, `estado`, solicitante y técnico asignado. |
| `tickets/{id}/messages/{id}` | Mensajes de la conversación (`message` o `solution`). |
| `ticketCounters/global` | Último número de ticket asignado. |

## Limitaciones conocidas

- Las listas de tickets cargan toda la colección. Con miles de tickets convendría paginar las consultas.
- El registro está abierto a cualquier correo o cuenta de Google. Para limitarlo a un dominio corporativo, añade una condición sobre `request.auth.token.email` en la regla `create` de `users`.
- Crear o eliminar cuentas de Authentication, y degradar administradores, se hace desde la consola de Firebase.
