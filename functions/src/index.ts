import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

/** Limita las funciones administrativas a la región elegida para TicketDesk. */
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

/** Inicializa Admin SDK una sola vez para todas las operaciones callable. */
initializeApp();

/** Instancias confiables para Authentication y Firestore. */
const adminAuth = getAuth();
const adminDb = getFirestore();

/** Roles permitidos para los perfiles de TicketDesk. */
type UserRole = 'admin' | 'technician' | 'user';

/** Datos normalizados que identifica a un usuario administrable. */
interface UserInput {
  email: string;
  username: string;
  department: string;
  phone: string;
  role: UserRole;
}

/** Obtiene un texto no vacío con límite de longitud para los datos recibidos. */
function requiredText(value: unknown, field: string, maximumLength: number): string {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `El campo ${field} no es válido.`);
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > maximumLength) {
    throw new HttpsError(
      'invalid-argument',
      `El campo ${field} es obligatorio y no puede superar ${maximumLength} caracteres.`
    );
  }

  return normalized;
}

/** Valida y normaliza nombre, departamento, teléfono y rol de una cuenta. */
function parseUserInput(data: Record<string, unknown>): Omit<UserInput, 'email'> {
  const role = data['role'];
  if (role !== 'admin' && role !== 'technician' && role !== 'user') {
    throw new HttpsError('invalid-argument', 'El rol seleccionado no es válido.');
  }

  return {
    username: requiredText(data['username'], 'nombre', 100),
    department: requiredText(data['department'], 'departamento', 100),
    phone: requiredText(data['phone'], 'teléfono', 40),
    role
  };
}

/** Confirma una sesión y verifica el rol real del invocador en su perfil. */
async function requireAdministrator(request: CallableRequest<unknown>): Promise<string> {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Inicia sesión para administrar las cuentas.');
  }

  const callerSnapshot = await adminDb.collection('users').doc(uid).get();
  if (!callerSnapshot.exists || callerSnapshot.data()?.['role'] !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un administrador puede realizar esta operación.');
  }

  return uid;
}

/** Protege la cuenta administrativa única de una eliminación o degradación accidental. */
async function assertAnotherAdministrator(targetUid: string, nextRole?: UserRole): Promise<void> {
  const targetSnapshot = await adminDb.collection('users').doc(targetUid).get();
  if (targetSnapshot.data()?.['role'] !== 'admin') {
    return;
  }
  if (nextRole === 'admin') {
    return;
  }

  const administrators = await adminDb.collection('users')
    .where('role', '==', 'admin')
    .get();
  if (administrators.size <= 1) {
    throw new HttpsError(
      'failed-precondition',
      'No se puede degradar ni eliminar al último administrador.'
    );
  }
}

/** Lista perfiles desde Admin SDK después de comprobar el rol del solicitante. */
export const adminListUsers = onCall(async (request) => {
  await requireAdministrator(request);

  const snapshot = await adminDb.collection('users').get();
  const users = snapshot.docs.map((userDocument) => {
    const data = userDocument.data();
    const role = data['role'];

    return {
      uid: userDocument.id,
      email: typeof data['email'] === 'string' ? data['email'] : '',
      username: typeof data['username'] === 'string' && data['username'].trim()
        ? data['username'].trim()
        : 'Sin nombre',
      department: typeof data['department'] === 'string' && data['department'].trim()
        ? data['department'].trim()
        : 'Sin departamento',
      phone: typeof data['phone'] === 'string' ? data['phone'] : '',
      role: role === 'admin' || role === 'technician' ? role : 'user'
    };
  });

  return { users };
});

/** Crea la cuenta de Auth y su perfil inicial, limpiando Auth ante un fallo de Firestore. */
export const adminCreateUser = onCall(async (request) => {
  await requireAdministrator(request);

  const data = request.data as Record<string, unknown>;
  const email = requiredText(data['email'], 'correo', 254).toLowerCase();
  const password = requiredText(data['password'], 'contraseña temporal', 128);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Escribe un correo válido.');
  }
  if (password.length < 6) {
    throw new HttpsError('invalid-argument', 'La contraseña temporal debe tener al menos 6 caracteres.');
  }

  const profile = parseUserInput(data);
  let createdUid = '';
  try {
    const createdUser = await adminAuth.createUser({
      email,
      password,
      displayName: profile.username,
      emailVerified: false,
      disabled: false
    });
    createdUid = createdUser.uid;

    const batch = adminDb.batch();
    const userRef = adminDb.collection('users').doc(createdUid);
    batch.set(userRef, {
      uid: createdUid,
      email,
      ...profile,
      profileCompleted: true,
      createdAt: FieldValue.serverTimestamp()
    });

    if (profile.role === 'technician') {
      batch.set(adminDb.collection('technicianDirectory').doc(createdUid), {
        uid: createdUid,
        username: profile.username,
        department: profile.department
      });
    }

    await batch.commit();
    return { uid: createdUid };
  } catch (error) {
    if (createdUid) {
      try {
        await adminAuth.deleteUser(createdUid);
      } catch (cleanupError) {
        console.error('Could not roll back a partially created Auth account:', cleanupError);
      }
    }
    if (error instanceof HttpsError) {
      throw error;
    }
    if (typeof error === 'object' && error !== null && 'code' in error
      && error.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Ya existe una cuenta con ese correo.');
    }
    console.error('Could not create managed user:', error);
    throw new HttpsError('internal', 'No se pudo crear la cuenta. Verifica los datos e inténtalo de nuevo.');
  }
});

/** Actualiza propiedades editables del perfil y sincroniza el directorio técnico. */
export const adminUpdateUser = onCall(async (request) => {
  const callerUid = await requireAdministrator(request);
  const data = request.data as Record<string, unknown>;
  const uid = requiredText(data['uid'], 'identificador', 128);
  const profile = parseUserInput(data);

  try {
    const userRef = adminDb.collection('users').doc(uid);
    const userSnapshot = await userRef.get();
    if (!userSnapshot.exists) {
      throw new HttpsError('not-found', 'La cuenta seleccionada ya no existe.');
    }
    if (uid === callerUid && userSnapshot.data()?.['role'] !== profile.role) {
      throw new HttpsError('failed-precondition', 'No puedes cambiar tu propio rol desde esta pantalla.');
    }
    await assertAnotherAdministrator(uid, profile.role);

    const batch = adminDb.batch();
    batch.update(userRef, profile);
    const technicianRef = adminDb.collection('technicianDirectory').doc(uid);

    if (profile.role === 'technician') {
      batch.set(technicianRef, {
        uid,
        username: profile.username,
        department: profile.department
      });
    } else {
      batch.delete(technicianRef);
    }

    await adminAuth.updateUser(uid, { displayName: profile.username });
    await batch.commit();
    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error('Could not update managed user:', error);
    throw new HttpsError('internal', 'No se pudo actualizar la cuenta.');
  }
});

/** Elimina Authentication y su ficha sin borrar tickets ni sus archivos históricos. */
export const adminDeleteUser = onCall(async (request) => {
  const callerUid = await requireAdministrator(request);
  const uid = requiredText((request.data as Record<string, unknown>)['uid'], 'identificador', 128);
  if (uid === callerUid) {
    throw new HttpsError('failed-precondition', 'No puedes eliminar tu propia cuenta administrativa.');
  }

  await assertAnotherAdministrator(uid);
  const userRef = adminDb.collection('users').doc(uid);
  const userSnapshot = await userRef.get();
  if (!userSnapshot.exists) {
    throw new HttpsError('not-found', 'La cuenta seleccionada ya no existe.');
  }

  try {
    try {
      await adminAuth.deleteUser(uid);
    } catch (error) {
      if (typeof error !== 'object' || error === null
        || !('code' in error) || error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    const batch = adminDb.batch();
    batch.delete(userRef);
    batch.delete(adminDb.collection('technicianDirectory').doc(uid));
    await batch.commit();
    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error('Could not delete managed user:', error);
    throw new HttpsError(
      'internal',
      'No se pudo completar la baja de la cuenta. Revisa Firebase antes de volver a intentarlo.'
    );
  }
});
