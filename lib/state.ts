import Emitter from "./eventEmitter";
import type { EventHandler } from "./types";

export default class StateMachine {
  initialState: string;
  currState: string;
  states: Set<string>;
  transitioning: boolean;
  started: boolean;
  emitter: Emitter;
  constructor(initialState: string, states: string[]) {
    this.initialState = initialState;
    this.currState = initialState;
    this.states = new Set(states);
    this.transitioning = false;
    this.started = false;
    this.emitter = new Emitter();
  }

  on(state: string, event: string, fn: EventHandler) {
    if (!this.states.has(state)) throw new Error(`Invalid state: ${state}`);
    return this.emitter.on(`${state}-${event}`, fn);
  }

  async emit(event: string, ...data: any[]) {
    if (!this.started) throw new Error("Machine not started - call `start` first!");
    if (event === "enter" || event === "exit") {
      throw new Error(`Reserved event: ${event} - use state transitions instead`);
    }
    await this.emitter.emit(`${this.currState}-${event}`, ...data);
    if (event !== "*") await this.emitter.emit(`${this.currState}-*`, ...data);
  }

  async start(...data: any[]) {
    if (this.started) return;
    this.started = true;
    await this.emitter.emit(`${this.initialState}-enter`, this.initialState, this.initialState, ...data);
  }

  async enter(state: string, ...data: any[]) {
    if (this.currState === state) return;
    if (this.transitioning) throw new Error("State transition already in progress");
    if (!this.states.has(state)) throw new Error(`Invalid state: ${state}`);
    const prev = this.currState;
    const next = state;
    try {
      this.transitioning = true;
      await this.emitter.emit(`${prev}-exit`, prev, next, ...data);
      await this.emitter.emit(`${prev}-*`, prev, next, ...data);
      this.transitioning = false;
      this.currState = next;
      await this.emitter.emit(`${next}-enter`, prev, next, ...data);
      await this.emitter.emit(`${next}-*`, prev, next, ...data);
    } finally {
      this.transitioning = false;
    }
  }

  onExit(state: string, fn: EventHandler) {
    return this.on(state, "exit", fn);
  }

  onEnter(state: string, fn: EventHandler) {
    return this.on(state, "enter", fn);
  }

  onUpdate(state: string, fn: EventHandler) {
    return this.on(state, "update", fn);
  }

  in(...states: string[]) {
    if (states.includes("*")) states = [...this.states];
    return {
      on: (event: string, fn: EventHandler) => {
        const unsubscribes = states.map(state => this.on(state, event, fn));
        return () => {
          for (const unsub of unsubscribes) unsub();
        };
      },
    };
  }

  async once(state: string, event: string, pred: (...params: any[]) => boolean = () => true) {
    if (!this.states.has(state)) throw new Error(`Invalid state: ${state}`);
    return this.emitter.once(`${state}-${event}`, pred);
  }

  controlled(state: string, generator: (...arg0: any[]) => Generator | AsyncGenerator) {
    return this.onEnter(state, (_p, _c, ...generatorParams) => {
      const _generator = generator(...generatorParams);
      function cleanup() {
        offUpdate();
        offExit();
      }
      const offUpdate = this.onUpdate(state, async () => {
        if ((await _generator.next()).done) cleanup();
      });
      const offExit = this.onExit(state, cleanup);
    });
  }
}

