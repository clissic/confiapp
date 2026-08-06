/** Principales ciudades y centros urbanos de Uruguay (orden alfabético). */
export const URUGUAY_CITIES = [
  'Artigas',
  'Atlántida',
  'Barros Blancos',
  'Bella Unión',
  'Canelones',
  'Carmelo',
  'Ciudad de la Costa',
  'Colonia del Sacramento',
  'Dolores',
  'Durazno',
  'Florida',
  'Fray Bentos',
  'Juan Lacaze',
  'La Paz',
  'Las Piedras',
  'Libertad',
  'Maldonado',
  'Melo',
  'Mercedes',
  'Minas',
  'Montevideo',
  'Nueva Helvecia',
  'Nueva Palmira',
  'Pando',
  'Paso de los Toros',
  'Paysandú',
  'Punta del Este',
  'Río Branco',
  'Rivera',
  'Rocha',
  'Salto',
  'San Carlos',
  'San José de Mayo',
  'Santa Lucía',
  'Tacuarembó',
  'Treinta y Tres',
  'Trinidad',
  'Young',
] as const;

export type UruguayCity = (typeof URUGUAY_CITIES)[number];

export function isUruguayCity(value: string): value is UruguayCity {
  return (URUGUAY_CITIES as readonly string[]).includes(value);
}
