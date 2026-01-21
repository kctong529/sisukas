// src/lib/stores/colorAllocator.ts
import { writable } from 'svelte/store';
import type { Block } from '../../domain/models/Block';

const PALETTE_SIZE = 6;

function computeNext(blocks: Block[]): number {
  const used = new Set<number>();
  for (const b of blocks) used.add(b.colorIndex);

  for (let i = 0; i < PALETTE_SIZE; i++) {
    if (!used.has(i)) return i;
  }
  return blocks.length % PALETTE_SIZE;
}

// Tiny reactive signal: bump whenever reservations change
export const colorAllocatorVersion = writable(0);
function bump() {
  colorAllocatorVersion.update(v => v + 1);
}

class ColorAllocator {
  private reservations = new Map<string, number>();

  peek(courseInstanceId: string, blocks: Block[]): number {
    const reserved = this.reservations.get(courseInstanceId);
    return reserved !== undefined ? reserved : computeNext(blocks);
  }

  reserve(courseInstanceId: string, blocks: Block[]): number {
    const existing = this.reservations.get(courseInstanceId);
    if (existing !== undefined) return existing;

    const next = computeNext(blocks);
    this.reservations.set(courseInstanceId, next);
    bump();
    return next;
  }

  clearReservation(courseInstanceId: string) {
    if (this.reservations.delete(courseInstanceId)) {
      bump();
    }
  }
}

export const colorAllocator = new ColorAllocator();
