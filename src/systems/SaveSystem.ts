/**
 * SaveSystem (SPEC §11): persistencia en `localStorage` bajo la clave única
 * `jekyll_hyde_save_v1` con el esquema `SaveData` (levelsCompleted,
 * lastScore, muted, inProgress).
 *
 * Robustez ante save corrupto/ausente/esquema inválido: `load()` envuelve
 * TODO en try/catch y sanitiza CAMPO A CAMPO con validación de tipos — un
 * campo inválido cae al default de ESE campo sin arrastrar el resto.
 *
 * Sin import de Phaser: el storage se inyecta (default
 * `globalThis.localStorage`, con fallback a memoria si no existe) para que
 * los tests puedan usar tanto localStorage de jsdom como un fake.
 */

/** Clave única de persistencia (SPEC §11). */
export const SAVE_KEY = 'jekyll_hyde_save_v1';

/** Esquema persistido (SPEC §11). */
export interface SaveData {
  /** Niveles terminados (v1: 0 | 1). */
  levelsCompleted: number;
  /** Mejor puntaje registrado (récord). */
  lastScore: number;
  /** Silencio global (toggle persistente, SPEC §8). */
  muted: boolean;
  /** Partida empezada y no terminada (habilita «Continuar» en Menu). */
  inProgress: boolean;
}

/** Valores por defecto: partida limpia con sonido. */
export const DEFAULT_SAVE: Readonly<SaveData> = Object.freeze({
  levelsCompleted: 0,
  lastScore: 0,
  muted: false,
  inProgress: false,
});

/** Contrato estructural del storage (lo cumple `localStorage` y los fakes). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Storage en memoria (fallback si `localStorage` no existe, p. ej. SSR). */
class InMemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

/** Entero finito ≥ 0 (niveles y puntajes son enteros no negativos). */
function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Booleano estricto (nada de 0/1/'true' tratables). */
function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/** Sanitiza campo a campo; los inválidos caen a su default. */
function sanitize(raw: unknown): SaveData {
  const candidate = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    levelsCompleted: isCount(candidate.levelsCompleted)
      ? candidate.levelsCompleted
      : DEFAULT_SAVE.levelsCompleted,
    lastScore: isCount(candidate.lastScore) ? candidate.lastScore : DEFAULT_SAVE.lastScore,
    muted: isBoolean(candidate.muted) ? candidate.muted : DEFAULT_SAVE.muted,
    inProgress: isBoolean(candidate.inProgress) ? candidate.inProgress : DEFAULT_SAVE.inProgress,
  };
}

export class SaveSystem {
  private readonly storage: StorageLike;
  private data: SaveData;

  constructor(storage?: StorageLike) {
    this.storage = storage ?? SaveSystem.defaultStorage();
    this.data = this.load();
  }

  /** Storage por defecto: `localStorage` del entorno o memoria. */
  private static defaultStorage(): StorageLike {
    try {
      if (typeof globalThis.localStorage !== 'undefined') {
        return globalThis.localStorage;
      }
    } catch {
      // Acceso a localStorage puede lanzar (permisos): caer a memoria.
    }
    return new InMemoryStorage();
  }

  /**
   * Lee y sanitiza el save. Ante JSON corrupto, tipo inesperado o clave
   * ausente devuelve `DEFAULT_SAVE` (nunca lanza, SPEC §11).
   */
  load(): SaveData {
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(SAVE_KEY);
    } catch {
      return { ...DEFAULT_SAVE };
    }
    if (raw === null) {
      return { ...DEFAULT_SAVE };
    }
    try {
      return sanitize(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_SAVE };
    }
  }

  /**
   * Merge superficial de `partial` sobre el estado actual + persistencia.
   * Devuelve el estado resultante. Los fallos de escritura (cuota, modo
   * privado) se ignoran: el juego sigue con el estado en memoria.
   */
  save(partial: Partial<SaveData>): SaveData {
    this.data = sanitize({ ...this.data, ...partial });
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // Sin persistencia disponible: mantener estado en memoria.
    }
    return { ...this.data };
  }

  /** Estado actual (copia defensiva). */
  getData(): Readonly<SaveData> {
    return { ...this.data };
  }

  // ---- Getters tipados ------------------------------------------------

  get levelsCompleted(): number {
    return this.data.levelsCompleted;
  }

  get lastScore(): number {
    return this.data.lastScore;
  }

  get muted(): boolean {
    return this.data.muted;
  }

  get inProgress(): boolean {
    return this.data.inProgress;
  }

  // ---- Setters tipados -------------------------------------------------

  /** Toggle de mute persistente (SPEC §8: se guarda al togglear). */
  setMuted(muted: boolean): void {
    this.save({ muted });
  }

  /** Marca que hay partida en curso (habilita «Continuar», SPEC §11). */
  setInProgress(inProgress: boolean): void {
    this.save({ inProgress });
  }

  /**
   * Nivel completado (SPEC §11): actualiza récord (`lastScore` conserva el
   * MÁXIMO), sube `levelsCompleted` al nivel completado (máx.) y limpia
   * `inProgress`. `levelId` por defecto 1 (v1 solo tiene el Nivel 1).
   */
  markLevelComplete(score: number, levelId = 1): void {
    this.save({
      levelsCompleted: Math.max(this.data.levelsCompleted, levelId),
      lastScore: Math.max(this.data.lastScore, score),
      inProgress: false,
    });
  }

  /** Borra el save y vuelve a los defaults (persiste el arranque limpio). */
  clear(): void {
    this.data = { ...DEFAULT_SAVE };
    try {
      this.storage.removeItem(SAVE_KEY);
    } catch {
      // Ídem save(): nunca romper por el storage.
    }
  }
}
