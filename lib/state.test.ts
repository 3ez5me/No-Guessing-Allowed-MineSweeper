import StateMachine from "./state.ts";
import type { EventHandler } from "./types.d.ts";

describe("StateMachine", () => {
  let machine: StateMachine;
  const initialState = "idle";
  const states = ["idle", "running", "paused", "stopped"];

  beforeEach(() => {
    machine = new StateMachine(initialState, states);
  });

  afterEach(() => vi.clearAllMocks());

  describe("constructor", () => {
    it("should initialize with correct initial state", () => {
      expect(machine.initialState).toBe(initialState);
      expect(machine.currState).toBe(initialState);
      expect(machine.states).toEqual(new Set(states));
      expect(machine.transitioning).toBe(false);
      expect(machine.started).toBe(false);
      expect(machine.emitter).toBeDefined();
    });
  });

  describe("on", () => {
    it("should register event handler for valid state", () => {
      const handler: EventHandler = vi.fn();
      const unsubscribe = machine.on("idle", "test", handler);

      expect(typeof unsubscribe).toBe("function");
    });

    it("should throw error for invalid state", () => {
      const handler: EventHandler = vi.fn();

      expect(() => machine.on("invalid-state", "test", handler)).toThrow("Invalid state: invalid-state");
    });
  });

  describe("onExit, onEnter, onUpdate", () => {
    it("should register exit handlers", () => {
      const handler: EventHandler = vi.fn();
      const unsubscribe = machine.onExit("idle", handler);
      expect(typeof unsubscribe).toBe("function");
    });

    it("should register enter handlers", () => {
      const handler: EventHandler = vi.fn();
      const unsubscribe = machine.onEnter("running", handler);
      expect(typeof unsubscribe).toBe("function");
    });

    it("should register update handlers", () => {
      const handler: EventHandler = vi.fn();
      const unsubscribe = machine.onUpdate("paused", handler);
      expect(typeof unsubscribe).toBe("function");
    });

    it("should throw error for invalid state in helper methods", () => {
      const handler: EventHandler = vi.fn();

      expect(() => machine.onExit("invalid", handler)).toThrow("Invalid state: invalid");
      expect(() => machine.onEnter("invalid", handler)).toThrow("Invalid state: invalid");
      expect(() => machine.onUpdate("invalid", handler)).toThrow("Invalid state: invalid");
    });
  });

  describe("start", () => {
    it("should set started flag and emit initial state enter event", async () => {
      const enterHandler = vi.fn();
      machine.onEnter("idle", enterHandler);

      expect(machine.started).toBe(false);
      await machine.start("some", "data");
      expect(machine.started).toBe(true);
      expect(enterHandler).toHaveBeenCalledWith("idle", "idle", "some", "data");
    });

    it("should do nothing if already started", async () => {
      await machine.start();
      const enterHandler: EventHandler = vi.fn();
      machine.onEnter("idle", enterHandler);

      await machine.start();
      // Machine has already started before handler was set up
      expect(enterHandler).not.toHaveBeenCalled();
    });

    it("should emit wildcard events", async () => {
      const wildcardHandler: EventHandler = vi.fn();
      machine.on("idle", "*", wildcardHandler);

      await machine.start("data");
      expect(wildcardHandler).toHaveBeenCalled();
    });
  });
  describe("emit", () => {
    beforeEach(async () => await machine.start());

    it("should emit event for current state", async () => {
      const handler: EventHandler = vi.fn();
      machine.on("idle", "test", handler);

      await machine.emit("test", "arg1", "arg2");

      expect(handler).toHaveBeenCalledWith("arg1", "arg2");
    });

    it("should emit wildcard events", async () => {
      const specificHandler: EventHandler = vi.fn();
      const wildcardHandler: EventHandler = vi.fn();

      machine.on("idle", "test", specificHandler);
      machine.on("idle", "*", wildcardHandler);

      await machine.emit("test", "data");

      expect(specificHandler).toHaveBeenCalledWith("data");
      expect(wildcardHandler).toHaveBeenCalledWith("data");
    });

    it("should throw error if machine not started", () => {
      const machine = new StateMachine(initialState, states);

      expect(() => machine.emit("test")).rejects.toThrow("Machine not started - call `start` first!");
    });

    it("should throw error for reserved events (enter/exit)", async () => {
      await expect(machine.emit("enter")).rejects.toThrow("Reserved event: enter - use state transitions instead");
      await expect(machine.emit("exit")).rejects.toThrow("Reserved event: exit - use state transitions instead");
    });

    it("should not emit wildcard for wildcard events / emit wildcard multiple times", async () => {
      const wildcardHandler: EventHandler = vi.fn();
      machine.on("idle", "*", wildcardHandler);

      await machine.emit("*", "data");

      // Should not double-emit for wildcard events
      expect(wildcardHandler).toHaveBeenCalledTimes(1);
      expect(wildcardHandler).toHaveBeenCalledWith("data");
    });
  });

  describe("enter", () => {
    beforeEach(async () => await machine.start());

    it("should transition between states and emit events", async () => {
      const exitHandler: EventHandler = vi.fn();
      const enterHandler: EventHandler = vi.fn();
      const wildcardHandlerIdle: EventHandler = vi.fn();
      const wildcardHandlerRunning: EventHandler = vi.fn();

      machine.onExit("idle", exitHandler);
      machine.onEnter("running", enterHandler);
      machine.on("idle", "*", wildcardHandlerIdle);
      machine.on("running", "*", wildcardHandlerRunning);

      await machine.enter("running", "transition", "data");

      expect(exitHandler).toHaveBeenCalledWith("idle", "running", "transition", "data");
      expect(wildcardHandlerIdle).toHaveBeenCalledWith("idle", "running", "transition", "data");
      expect(enterHandler).toHaveBeenCalledWith("idle", "running", "transition", "data");
      expect(wildcardHandlerRunning).toHaveBeenCalledWith("idle", "running", "transition", "data");
      expect(machine.currState).toBe("running");
    });

    it("should do nothing if transitioning to same state", async () => {
      const enterHandler: EventHandler = vi.fn();
      machine.onEnter("idle", enterHandler);

      await machine.enter("idle");

      expect(enterHandler).not.toHaveBeenCalled();
      expect(machine.currState).toBe("idle");
    });

    it("should throw error for invalid state", async () => {
      await expect(machine.enter("invalid")).rejects.toThrow("Invalid state: invalid");
    });

    it("should throw error if already transitioning", async () => {
      const transitionPromise = machine.enter("running");

      await expect(machine.enter("paused")).rejects.toThrow("State transition already in progress");
      // initial transition didn't finish
      await transitionPromise;
      // initial transition awaited
    });

    it("should reset transitioning flag even if errors occur", async () => {
      const errorHandler: EventHandler = vi.fn().mockRejectedValue(new Error("Exit error"));
      machine.onExit("idle", errorHandler);

      await expect(machine.enter("running")).rejects.toThrow("Exit error");

      expect(machine.transitioning).toBe(false);
      expect(machine.currState).toBe("idle");
    });

    it("should ensure transitioning flag is reset on success", async () => {
      await machine.enter("running");

      expect(machine.transitioning).toBe(false);
      expect(machine.currState).toBe("running");

      await machine.enter("paused");
      expect(machine.currState).toBe("paused");
    });
  });

  describe("in", () => {
    it("should work with mixed valid and invalid states", () => {
      const handler: EventHandler = vi.fn();

      expect(() => machine.in("idle", "invalid").on("test", handler)).toThrow("Invalid state: invalid");
    });
  });

  describe("controlled", () => {
    beforeEach(async () => await machine.start());

    it("should set up generator controller for state enter", async () => {
      const generator = vi.fn().mockImplementation(function* () {
        yield 1;
        yield 2;
        return 3;
      });

      const cleanupSpy = vi.spyOn(machine, "onExit");
      const updateSpy = vi.spyOn(machine, "onUpdate");

      machine.controlled("running", generator);

      // Transition to running to trigger the controlled generator
      await machine.enter("running", "gen-param");

      expect(generator).toHaveBeenCalledWith("gen-param");
      expect(cleanupSpy).toHaveBeenCalledWith("running", expect.any(Function));
      expect(updateSpy).toHaveBeenCalledWith("running", expect.any(Function));
    });

    // todo: better tests for controlled states
  });
});

