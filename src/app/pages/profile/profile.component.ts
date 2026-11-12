import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../core/firebase.config';
import { TicketsService } from '../../services/tickets';

type ProfileRole = 'admin' | 'technician' | 'user';

/** Presenta la identidad y las métricas personales de la cuenta autenticada. */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  username = '';
  email = '';
  department = '';
  role: ProfileRole | null = null;
  reportedTicketCount = 0;
  resolvedTicketCount = 0;
  isLoading = true;
  loadError = '';

  constructor(
    private ticketsService: TicketsService,
    private changeDetector: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadProfile();
  }

  /** Carga el perfil real y cuenta tickets reportados y resueltos por asignación. */
  async loadProfile(): Promise<void> {
    this.isLoading = true;
    this.loadError = '';

    try {
      await this.withTimeout(
        auth.authStateReady(),
        'La validación de sesión tardó demasiado. Inténtalo de nuevo.'
      );
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No hay una sesión activa. Inicia sesión para consultar tu perfil.');
      }

      const [profile, reportedTickets] = await this.withTimeout(
        Promise.all([
          getDoc(doc(db, 'users', user.uid)),
          this.ticketsService.listarPropios(user.uid)
        ]),
        'La consulta del perfil tardó demasiado.'
      );

      if (!profile.exists()) {
        throw new Error('No encontramos los datos de tu perfil.');
      }

      const profileData = profile.data();
      const role = profileData['role'];
      if (role !== 'admin' && role !== 'technician' && role !== 'user') {
        throw new Error('No pudimos verificar el tipo de cuenta de tu perfil.');
      }

      this.role = role;
      this.username = this.readString(profileData['username'])
        || user.displayName?.trim()
        || user.email?.split('@')[0]
        || 'Usuario';
      this.email = this.readString(profileData['email']) || user.email || '';
      this.department = this.readString(profileData['department']);
      this.reportedTicketCount = reportedTickets.length;

      if (role === 'technician') {
        const assignedTickets = await this.withTimeout(
          this.ticketsService.listarAsignados(user.uid),
          'La consulta de tickets resueltos tardó demasiado.'
        );
        this.resolvedTicketCount = assignedTickets.filter(
          ticket => ticket.estado === 'cerrado'
        ).length;
      } else {
        this.resolvedTicketCount = 0;
      }
    } catch (error) {
      console.error('Error al cargar el perfil:', error);
      this.loadError = error instanceof Error && error.message.trim()
        ? error.message
        : 'No se pudo cargar tu perfil. Revisa tu conexión e inténtalo de nuevo.';
    } finally {
      this.isLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  get roleLabel(): string {
    switch (this.role) {
      case 'admin':
        return 'Administrador';
      case 'technician':
        return 'Técnico';
      default:
        return 'Usuario';
    }
  }

  get profileInitials(): string {
    return this.username
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0))
      .join('')
      .toLocaleUpperCase('es');
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private async withTimeout<T>(operation: Promise<T>, message: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), 15_000);
    });

    try {
      return await Promise.race([operation, timeout]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }
}
