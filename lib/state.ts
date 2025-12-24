import Emitter from "./eventEmitter";

type BuiltInParams<TState extends string> = {
  enter: [prevState: TState];
  exit: [nextState: TState];
  update: [];
  "*": [];
};

type ResolveArgs<K, TEvents, TState extends string> = K extends keyof BuiltInParams<TState>
  ? BuiltInParams<TState>[K]
  : K extends keyof TEvents
  ? TEvents[K]
  : any[];

export default class StateMachine<TEvents extends { [K in keyof TEvents]: any[] }, TState extends string> {
  // For now: enforce type safety in StateMachine
  // Not exactly sure how to do the string concat types properly
  #emitter = new Emitter<Record<string, any[]>>();
  #currState: TState;
  #initialState: TState;
  #states: Set<TState>;
  #transitioning = false;
  #started = false;

  constructor(initialState: TState, states: TState[]) {
    this.#currState = initialState;
    this.#initialState = initialState;
    this.#states = new Set(states);
  }

  get currState() {
    return this.#currState;
  }

  get started() {
    return this.#started;
  }

  get transitioning() {
    return this.#transitioning;
  }

  on<K extends (keyof TEvents | keyof BuiltInParams<TState>) & string>(
    state: TState,
    event: K,
    fn: (...args: ResolveArgs<K, TEvents, TState>) => any
  ): () => void {
    if (!this.#states.has(state)) throw new Error(`Invalid state: ${state}`);
    return this.#emitter.on(`${state}-${event}`, fn);
  }

  onExit(state: TState, fn: (...args: BuiltInParams<TState>["exit"]) => any) {
    return this.on(state, "exit", fn);
  }

  onEnter(state: TState, fn: (...args: BuiltInParams<TState>["enter"]) => any) {
    return this.on(state, "enter", fn);
  }

  onUpdate(state: TState, fn: () => any) {
    return this.on(state, "update", fn);
  }

  async emit<K extends keyof TEvents & string>(event: K, ...data: TEvents[K]) {
    if (!this.#started) throw new Error("Machine not started");
    if (event === "enter" || event === "exit") {
      throw new Error(`Reserved event: ${event} - use state transitions instead`);
    }
    await this.#emitter.emit(`${this.#currState}-${event}`, ...data);
    if (event !== "*") await this.#emitter.emit(`${this.#currState}-*`);
  }

  async enter(state: TState) {
    if (this.#currState === state) return;
    // Maybe just return instead of throwing on transition?
    if (this.#transitioning) throw new Error("State transition already in progress");
    if (!this.#states.has(state)) throw new Error(`Invalid state: ${state}`);

    const prev = this.#currState;
    const next = state;

    try {
      this.#transitioning = true;
      await this.#emitter.emit(`${prev}-exit`, next);
      await this.#emitter.emit(`${prev}-*`);

      this.#currState = next;
      this.#transitioning = false;

      await this.#emitter.emit(`${next}-enter`, prev);
      await this.#emitter.emit(`${next}-*`);
    } finally {
      this.#transitioning = false;
    }
  }

  async start() {
    if (this.#started) return;
    this.#started = true;
    await this.#emitter.emit(`${this.#initialState}-enter`, this.#initialState);
    await this.#emitter.emit(`${this.#initialState}-*`);
  }

  in(...states: (TState | "*")[]) {
    const resolvedStates = states.includes("*") ? Array.from(this.#states) : (states as TState[]);

    return {
      on: <K extends (keyof TEvents | keyof BuiltInParams<TState>) & string>(
        event: K,
        fn: (...args: ResolveArgs<K, TEvents, TState>) => any
      ) => {
        const unsubscribes = resolvedStates.map(state => this.on(state, event, fn));
        return () => unsubscribes.forEach(unsub => unsub());
      },
    };
  }
}

// interface StateEventListener<TEvents extends { [K in keyof TEvents]: any[] }, TState extends string> {
//   <K extends keyof TEvents>(event: K, fn: (...args: TEvents[K]) => any): () => void;
//   <K extends keyof BuiltInParams<TState>>(event: K, fn: (...args: BuiltInParams<TState>[K]) => any): () => void;
// }

