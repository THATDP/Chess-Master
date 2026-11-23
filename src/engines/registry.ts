import type { EngineDefinition, EngineDescriptor, EngineSettings } from './types';

/**
 * Registro central de adversários. A UI só consulta este módulo.
 * Para adicionar uma engine: crie um adaptador + definição e chame
 * `registerEngine()` em `engines/index.ts`. Nada mais precisa mudar.
 */
const definitions = new Map<string, EngineDefinition>();

export function registerEngine(def: EngineDefinition) {
  if (definitions.has(def.descriptor.id)) {
    throw new Error(`Engine duplicada: ${def.descriptor.id}`);
  }
  definitions.set(def.descriptor.id, def);
}

export function listEngines(): EngineDescriptor[] {
  return [...definitions.values()].map((d) => d.descriptor).sort((a, b) => a.order - b.order);
}

export function getEngineDefinition(id: string): EngineDefinition | undefined {
  return definitions.get(id);
}

export function getEngineDescriptor(id: string): EngineDescriptor | undefined {
  return definitions.get(id)?.descriptor;
}

export function getDefaultEngineId(): string {
  return listEngines()[0]?.id ?? '';
}

/** Valores padrão do nível indicado (ou do nível padrão da engine). */
export function defaultSettingsFor(descriptor: EngineDescriptor, levelId?: string): EngineSettings {
  const level =
    descriptor.levels.find((l) => l.id === (levelId ?? descriptor.defaultLevelId)) ?? descriptor.levels[0];
  return { level: level.id, ...level.values };
}

/**
 * Normaliza configurações vindas do armazenamento local: descarta chaves
 * desconhecidas e limita valores aos intervalos declarados.
 */
export function sanitizeSettings(descriptor: EngineDescriptor, raw: unknown): EngineSettings {
  const base = defaultSettingsFor(descriptor);
  if (!raw || typeof raw !== 'object') return base;
  const src = raw as Record<string, unknown>;
  const levelIds = descriptor.levels.map((l) => l.id);
  const out: EngineSettings = { ...base };
  if (typeof src.level === 'string' && (levelIds.includes(src.level) || src.level === 'custom')) {
    const lvl = descriptor.levels.find((l) => l.id === src.level);
    out.level = src.level;
    if (lvl) Object.assign(out, lvl.values);
  }
  for (const f of descriptor.fields) {
    const v = src[f.key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[f.key] = Math.min(f.max, Math.max(f.min, v));
    }
  }
  return out;
}
