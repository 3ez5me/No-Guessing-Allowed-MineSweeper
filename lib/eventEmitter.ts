import type { EventHandler } from "./types";

export default class Emitter<TEventMap extends { [K in keyof TEventMap]: any[] }> {
  events = new Map<keyof TEventMap, Set<EventHandler>>();

  on<K extends keyof TEventMap>(event: K, fn: EventHandler<TEventMap[K]>) {
    if (!this.events.has(event)) this.events.set(event, new Set());
    this.events.get(event)!.add(fn);
    return () => this.off(event, fn);
  }

  off<K extends keyof TEventMap>(event: K, fn: EventHandler<TEventMap[K]>) {
    if (!this.events.has(event)) return;
    this.events.get(event)!.delete(fn);
    if (this.events.get(event)!.size === 0) this.events.delete(event);
  }

  async emit<K extends keyof TEventMap>(event: K, ...args: TEventMap[K]) {
    if (!this.events.has(event)) return;
    for (const fn of this.events.get(event)!) await fn(...args);
  }
}

