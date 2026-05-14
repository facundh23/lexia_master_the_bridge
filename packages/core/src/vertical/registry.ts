import type { VerticalDefinition } from './definition.js';
import { nacionalidadResidencia } from '../verticals/nacionalidad_residencia/manifest.js';

const _registry = new Map<string, VerticalDefinition>();

export function registerVertical(vertical: VerticalDefinition): void {
  _registry.set(vertical.slug, vertical);
}

export function getVertical(slug: string): VerticalDefinition | undefined {
  return _registry.get(slug);
}

export function getEnabledVerticals(): VerticalDefinition[] {
  return [..._registry.values()].filter((v) => v.enabled);
}

// Auto-register built-in verticals
registerVertical(nacionalidadResidencia);
