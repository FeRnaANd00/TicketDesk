/**
 * Pruebas de las reglas de seguridad de Firestore contra el emulador local.
 * Ejecutar con: npm run test:rules
 */
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  Firestore
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

const profiles = {
  admin1: { role: 'admin', username: 'Ana Admin' },
  admin2: { role: 'admin', username: 'Beto Admin' },
  tech1: { role: 'technician', username: 'Tomás Técnico' },
  user1: { role: 'user', username: 'Uriel Usuario' },
  user2: { role: 'user', username: 'Úrsula Usuaria' }
} as const;

type Uid = keyof typeof profiles;

const dbFor = (uid: Uid) => env.authenticatedContext(uid).firestore() as unknown as Firestore;

/** Crea un ticket nuevo junto con el contador global, igual que la app. */
function createTicketBatch(db: Firestore, ticketId: string, overrides: Record<string, unknown> = {}) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'ticketCounters/global'), { lastNumber: 1, lastTicketId: ticketId });
  batch.set(doc(db, 'tickets', ticketId), {
    titulo: 'La impresora no imprime',
    categoria: 'Soporte Técnico',
    descripcion: 'Desde esta mañana no responde.',
    estado: 'abierto',
    prioridad: 'media',
    fechaCreacion: serverTimestamp(),
    clienteId: 'user1',
    clienteNombre: profiles.user1.username,
    numero: 1,
    ...overrides
  });
  return batch.commit();
}

/** Inserta un ticket existente sin pasar por las reglas. */
async function seedTicket(ticketId: string, data: Record<string, unknown> = {}) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore() as unknown as Firestore, 'tickets', ticketId), {
      titulo: 'Sin red',
      categoria: 'Redes y comunicaciones',
      descripcion: 'No hay conexión.',
      estado: 'abierto',
      prioridad: 'alta',
      fechaCreacion: new Date(),
      clienteId: 'user1',
      clienteNombre: profiles.user1.username,
      numero: 10,
      ...data
    });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ticketdesk',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    for (const [uid, profile] of Object.entries(profiles)) {
      await setDoc(doc(db, 'users', uid), {
        uid,
        email: `${uid}@example.com`,
        department: 'TI',
        phone: '555-0100',
        profileCompleted: true,
        ...profile
      });
    }
    await setDoc(doc(db, 'technicianDirectory/tech1'), {
      uid: 'tech1',
      username: profiles.tech1.username,
      department: 'TI'
    });
  });
});

describe('perfiles de usuario', () => {
  const newProfile = (role: string) => ({
    uid: 'nuevo',
    email: 'nuevo@example.com',
    username: 'Nuevo',
    department: 'Ventas',
    phone: '555-0199',
    role,
    profileCompleted: true,
    createdAt: serverTimestamp()
  });

  it('una persona crea su propio perfil como user', async () => {
    const db = env.authenticatedContext('nuevo').firestore() as unknown as Firestore;
    await assertSucceeds(setDoc(doc(db, 'users/nuevo'), newProfile('user')));
  });

  it('nadie puede auto-asignarse el rol admin al registrarse', async () => {
    const db = env.authenticatedContext('nuevo').firestore() as unknown as Firestore;
    await assertFails(setDoc(doc(db, 'users/nuevo'), newProfile('admin')));
  });

  it('un usuario no puede leer el perfil de otro', async () => {
    await assertFails(getDoc(doc(dbFor('user1'), 'users/user2')));
  });

  it('un usuario no puede cambiar su propio rol', async () => {
    await assertFails(updateDoc(doc(dbFor('user1'), 'users/user1'), { role: 'admin' }));
  });

  it('un admin degrada a un técnico a user y retira su ficha técnica', async () => {
    const db = dbFor('admin1');
    const batch = writeBatch(db);
    batch.update(doc(db, 'users/tech1'), { role: 'user' });
    batch.delete(doc(db, 'technicianDirectory/tech1'));
    await assertSucceeds(batch.commit());
  });

  it('un admin no puede degradar a otro admin', async () => {
    await assertFails(updateDoc(doc(dbFor('admin1'), 'users/admin2'), { role: 'user' }));
  });
});

describe('creación de tickets', () => {
  it('el solicitante crea un ticket válido', async () => {
    await assertSucceeds(createTicketBatch(dbFor('user1'), 't1'));
  });

  it('rechaza un nombre de solicitante falso', async () => {
    await assertFails(createTicketBatch(dbFor('user1'), 't1', { clienteNombre: 'Gerente General' }));
  });

  it('rechaza una fecha de creación inventada', async () => {
    await assertFails(createTicketBatch(dbFor('user1'), 't1', { fechaCreacion: new Date(2000, 0, 1) }));
  });

  it('rechaza asignar el ticket a alguien que no es técnico', async () => {
    await assertFails(createTicketBatch(dbFor('user1'), 't1', {
      tecnicoAsignadoId: 'user2',
      tecnicoAsignadoNombre: profiles.user2.username
    }));
  });

  it('acepta asignar el ticket a un técnico real', async () => {
    await assertSucceeds(createTicketBatch(dbFor('user1'), 't1', {
      tecnicoAsignadoId: 'tech1',
      tecnicoAsignadoNombre: profiles.tech1.username
    }));
  });

  it('rechaza títulos demasiado largos', async () => {
    await assertFails(createTicketBatch(dbFor('user1'), 't1', { titulo: 'x'.repeat(121) }));
  });
});

describe('gestión de tickets', () => {
  it('otro usuario no puede leer un ticket ajeno', async () => {
    await seedTicket('t1');
    await assertFails(getDoc(doc(dbFor('user2'), 'tickets/t1')));
  });

  it('el solicitante puede cerrar su ticket', async () => {
    await seedTicket('t1');
    await assertSucceeds(updateDoc(doc(dbFor('user1'), 'tickets/t1'), { estado: 'cerrado' }));
  });

  it('el solicitante no puede marcarlo "en proceso" (bloquearía la autoasignación)', async () => {
    await seedTicket('t1');
    await assertFails(updateDoc(doc(dbFor('user1'), 'tickets/t1'), { estado: 'en proceso' }));
  });

  it('un técnico se autoasigna un ticket abierto sin asignar', async () => {
    await seedTicket('t1');
    await assertSucceeds(updateDoc(doc(dbFor('tech1'), 'tickets/t1'), {
      estado: 'en proceso',
      tecnicoAsignadoId: 'tech1',
      tecnicoAsignadoNombre: profiles.tech1.username
    }));
  });

  it('solo un admin puede eliminar tickets', async () => {
    await seedTicket('t1');
    await assertFails(deleteDoc(doc(dbFor('user1'), 'tickets/t1')));
    await assertSucceeds(deleteDoc(doc(dbFor('admin1'), 'tickets/t1')));
  });
});

describe('conversación', () => {
  const message = (uid: Uid, type = 'message') => ({
    text: 'Hola',
    authorId: uid,
    authorName: profiles[uid].username,
    authorRole: profiles[uid].role,
    type,
    createdAt: serverTimestamp()
  });

  it('el solicitante escribe en su ticket', async () => {
    await seedTicket('t1');
    await assertSucceeds(setDoc(doc(dbFor('user1'), 'tickets/t1/messages/m1'), message('user1')));
  });

  it('el solicitante no puede publicar una "solución"', async () => {
    await seedTicket('t1');
    await assertFails(setDoc(doc(dbFor('user1'), 'tickets/t1/messages/m1'), message('user1', 'solution')));
  });

  it('un técnico no asignado no puede participar', async () => {
    await seedTicket('t1');
    await assertFails(setDoc(doc(dbFor('tech1'), 'tickets/t1/messages/m1'), message('tech1')));
  });

  it('editar un mensaje exige registrar editedAt', async () => {
    await seedTicket('t1');
    const db = dbFor('user1');
    await setDoc(doc(db, 'tickets/t1/messages/m1'), message('user1'));
    await assertFails(updateDoc(doc(db, 'tickets/t1/messages/m1'), { text: 'Cambiado' }));
    await assertSucceeds(updateDoc(doc(db, 'tickets/t1/messages/m1'), {
      text: 'Cambiado',
      editedAt: serverTimestamp()
    }));
  });
});
