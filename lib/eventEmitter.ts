import type { EventHandler } from "./types";

export default class Emitter {
  events: Map<string, Set<EventHandler>>;
  constructor() {
    this.events = new Map();
  }

  on(event: string, fn: EventHandler) {
    if (!this.events.has(event)) this.events.set(event, new Set());
    this.events.get(event)!.add(fn);
    return () => this.off(event, fn);
  }

  off(event: string, fn: EventHandler) {
    if (!this.events.has(event)) return;
    this.events.get(event)!.delete(fn);
    if (this.events.get(event)!.size === 0) this.events.delete(event);
  }

  async emit(event: string, ...data: any[]) {
    if (!this.events.has(event)) return;
    for (const fn of this.events.get(event)!) await fn(...data);
  }

  once(event: string, pred: (...params: any[]) => boolean = () => true) {
    let resolved = false;
    return new Promise(resolve => {
      const off = this.on(event, (...params) => {
        if (resolved || !pred(...params)) return;
        resolved = true;
        off();
        resolve(params);
      });
    });
  }
}

