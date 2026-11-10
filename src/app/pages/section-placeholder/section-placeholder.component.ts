import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/**
 * Presenta una pantalla temporal para las rutas que ya aparecen en el menú,
 * pero cuyo contenido funcional se diseñará en una etapa posterior.
 */
@Component({
  selector: 'app-section-placeholder',
  standalone: true,
  templateUrl: './section-placeholder.component.html',
  styleUrl: './section-placeholder.component.css'
})
export class SectionPlaceholderComponent implements OnInit {
  /** Título de sección provisto por la configuración de rutas. */
  title = 'Sección';
  /** Mensaje contextual que indica que el contenido se desarrollará después. */
  description = 'Esta sección se preparará en la siguiente etapa del sistema.';

  /** Lee los datos de presentación configurados en la ruta actual. */
  constructor(private route: ActivatedRoute) {}

  /** Carga el título y la descripción definidos por la ruta hija. */
  ngOnInit(): void {
    this.title = this.route.snapshot.data['title'] ?? this.title;
    this.description = this.route.snapshot.data['description'] ?? this.description;
  }
}
