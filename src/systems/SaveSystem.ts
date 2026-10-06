/**
 * SaveSystem (SPEC §11): persistencia en `localStorage` bajo la clave única
 * `jekyll_hyde_save_v1` con el esquema `SaveData` (levelsCompleted,
 * lastScore, muted, inProgress, currentLevel).
 *
 * Fase 4 del multi-nivel: `currentLevel` es el CHECKPOINT de nivel — el
 * nivel donde «Continuar» retoma la partida (solo tiene efecto mientras
 * `inProgress === true`; al completar la obra queda congelado pero ignorable).
 * Los saves PREVIOS sin el campo cargan bien: la sanitización campo a campo
 * cae al default 1 (misma garantía que el resto del esquema).
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

/** Esquema persistido (SPEC §11 + checkpoint multi-nivel de la Fase 4). */
export interface SaveData {
  /** Niveles terminados (0…3: el arco completo tiene 3 niveles). */
  levelsCompleted: number;
  /** Mejor puntaje registrado (récord). */
  lastScore: number;
  /** Silencio global (toggle persistente, SPEC §8). */
  muted: boolean;
  /** Partida empezada y no terminada (habilita «Continuar» en Menu). */
  inProgress: boolean;
  /**
   * Nivel donde retomar («Continuar» → INTRO {levelId: currentLevel}: la
   * cinemática lo reenvía a NARRATIVE al cerrar). Solo tiene efecto con
   * `inProgress === true`. Base 1 (default 1: el primer nivel del arco).
   */
  currentLevel: number;
}

/** Valores por defecto: partida limpia con sonido, arrancando en el N1. */
export const DEFAULT_SAVE: Readonly<SaveData> = Object.freeze({
  levelsCompleted: 0,
  lastScore: 0,
  muted: false,
  inProgress: false,
  currentLevel: 1,
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

/**
 * Id de nivel válido: entero ≥ 1 (los niveles son base 1). Los ids no
 * registrados se toleran aquí (la escena degrada con `activeLevelFor`); la
 * sanitización solo garantiza forma de id, no pertenencia al registro.
 */
function isLevelId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
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
    // Checkpoint multi-nivel (Fase 4): saves viejos SIN el campo caen a 1.
    currentLevel: isLevelId(candidate.currentLevel)
      ? candidate.currentLevel
      : DEFAULT_SAVE.currentLevel,
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

  get currentLevel(): number {
    return this.data.currentLevel;
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
   * Fija el CHECKPOINT de nivel (Fase 4 del multi-nivel): el nivel donde
   * «Continuar» retomará la partida. Puntos de llamada: «Comenzar el viaje»
   * (vía `beginJourney` → 1) y el QUIZ CORRECTO al avanzar (→ N+1, en
   * QuizScene). El quiz FALLADO NO lo toca (reinicio del mismo nivel, D5).
   * Basura → default 1 vía sanitización (floor primero para tolerar decimales).
   */
  setCurrentLevel(levelId: number): void {
    this.save({ currentLevel: Math.floor(levelId) });
  }

  /**
   * Nivel completado (SPEC §11): actualiza récord (`lastScore` conserva el
   * MÁXIMO), sube `levelsCompleted` al nivel completado (máx.) y limpia
   * `inProgress`. `levelId` por defecto 1. NO toca `currentLevel`: tras
   * completar la obra «Continuar» ya no aparece (inProgress = false) y una
   * nueva partida siempre vuelve a 1 vía `beginJourney`.
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
