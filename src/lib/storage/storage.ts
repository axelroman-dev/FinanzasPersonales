import { LocalStorage } from "./local";

/**
 * Dónde se guardan los bytes de los adjuntos (ya cifrados). Hoy en disco; la
 * interfaz permite cambiar a S3 u otro sin tocar el resto de la app.
 */
export interface Storage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** No falla si el archivo ya no existe */
  delete(key: string): Promise<void>;
  /** Borra todos los archivos de un usuario */
  deletePrefix(userId: string): Promise<void>;
  /** Todas las keys guardadas (para limpiar huérfanos) */
  list(): Promise<string[]>;
}

let storage: Storage | null = null;

export function getStorage(): Storage {
  storage ??= new LocalStorage(process.env.ATTACHMENTS_DIR);
  return storage;
}
