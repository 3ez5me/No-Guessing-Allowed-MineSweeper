import Emitter from "./eventEmitter";
import type { EventHandler } from "./types.d.ts";

describe("Emitter", () => {
  let emitter: Emitter;
  let handler: EventHandler;

  beforeEach(() => {
    emitter = new Emitter();
    handler = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("on", () => {
    it("should register an event handler", () => {
      emitter.on("test", handler);

      expect(emitter.events.has("test")).toBe(true);
      expect(emitter.events.get("test")?.size).toBe(1);
      expect(emitter.events.get("test")?.has(handler)).toBe(true);
    });

    it("should allow multiple handlers for same event", () => {
      const handler2 = vi.fn();

      emitter.on("test", handler);
      emitter.on("test", handler2);

      expect(emitter.events.get("test")?.size).toBe(2);
      expect(emitter.events.get("test")?.has(handler)).toBe(true);
      expect(emitter.events.get("test")?.has(handler2)).toBe(true);
    });

    it("should return an unsubscribe function", () => {
      const unsubscribe = emitter.on("test", handler);
      expect(typeof unsubscribe).toBe("function");
    });

    it("should remove unused handlers when unsubscribe function is called", () => {
      const handler2 = vi.fn();
      const unsubscribe1 = emitter.on("test", handler);
      const unsubscribe2 = emitter.on("test", handler2);

      expect(emitter.events.get("test")?.size).toBe(2);

      unsubscribe1(); // >=1 handler remaining
      expect(emitter.events.get("test")?.size).toBe(1);
      expect(emitter.events.get("test")?.has(handler)).toBe(false);
      expect(emitter.events.get("test")?.has(handler2)).toBe(true);

      unsubscribe2(); // 0 handlers remaining
      expect(emitter.events.has("test")).toBe(false);
    });

    it("should not duplicate same handler", () => {
      emitter.on("test", handler);
      emitter.on("test", handler);

      expect(emitter.events.get("test")?.size).toBe(1);
    });
  });

  describe("off", () => {
    it("should remove specific handler", () => {
      const handler2 = vi.fn();

      emitter.on("test", handler);
      emitter.on("test", handler2);

      emitter.off("test", handler);

      expect(emitter.events.get("test")?.has(handler)).toBe(false);
      expect(emitter.events.get("test")?.has(handler2)).toBe(true);
      expect(emitter.events.get("test")?.size).toBe(1);
    });

    it("should delete event when no handlers remain", () => {
      emitter.on("test", handler);
      emitter.off("test", handler);

      expect(emitter.events.has("test")).toBe(false);
    });

    it("should do nothing if event does not exist", () => {
      expect(() => emitter.off("nonexistent", handler)).not.toThrow();
    });

    it("should do nothing if handler not registered", () => {
      const handler2 = vi.fn();

      emitter.on("test", handler);
      emitter.off("test", handler2); // handler2 not registered

      expect(emitter.events.get("test")?.size).toBe(1);
    });
  });

  describe("emit", () => {
    it("should call all handlers with correct arguments", async () => {
      const handler2 = vi.fn();

      emitter.on("test", handler);
      emitter.on("test", handler2);

      const testData = { foo: "bar" };
      await emitter.emit("test", testData, 123);

      expect(handler).toHaveBeenCalledWith(testData, 123);
      expect(handler2).toHaveBeenCalledWith(testData, 123);
    });

    it("should handle async handlers", async () => {
      const asyncHandler = vi.fn().mockResolvedValue("async result");

      emitter.on("test", asyncHandler);
      await emitter.emit("test", "data");

      expect(asyncHandler).toHaveBeenCalledWith("data");
    });

    it("should do nothing if no handlers for event", async () => {
      await expect(emitter.emit("nonexistent", "data")).resolves.not.toThrow();
    });

    it("should preserve order of handler execution", async () => {
      const callOrder: number[] = [];

      const handler1 = vi.fn().mockImplementation(() => callOrder.push(1));
      const handler2 = vi.fn().mockImplementation(() => callOrder.push(2));

      emitter.on("test", handler1);
      emitter.on("test", handler2);

      await emitter.emit("test");

      expect(callOrder).toEqual([1, 2]);
    });
  });

  describe("once", () => {
    it("should resomve with event data when event occurs", async () => {
      const promise = emitter.once("test");

      setTimeout(() => emitter.emit("test", "data", 123), 0);

      const result = await promise;
      expect(result).toEqual(["data", 123]);
    });

    it("should remove handler after first emission", async () => {
      emitter.once("test");

      expect(emitter.events.has("test")).toBe(true);
      await emitter.emit("test", "first");
      expect(emitter.events.has("test")).toBe(false);
      await emitter.emit("test", "second");
      expect(emitter.events.has("test")).toBe(false);
    });

    it("should work with multiple once calls for same event", async () => {
      const promise1 = emitter.once("test");
      const promise2 = emitter.once("test");

      setTimeout(() => emitter.emit("test", "data"), 0);

      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toEqual(["data"]);
      expect(result2).toEqual(["data"]);
    });

    it("should not resolve if predicate never satisfied", async () => {
      const predicate = vi.fn(() => false);
      const promise = emitter.once("test", predicate);

      setTimeout(() => emitter.emit("test", "data"), 0);
      setTimeout(() => emitter.emit("test", "more data"), 10);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(promise).toBeInstanceOf(Promise);
      // Promise = pending
      expect(vi.isMockFunction(predicate)).toBe(true);
      expect(predicate).toHaveBeenCalledTimes(2);
    });
  });

  describe("integration", () => {
    it("should handle event chains", async () => {
      const results: string[] = [];

      emitter.on("start", async () => {
        results.push("start");
        await emitter.emit("middle");
      });

      emitter.on("middle", () => {
        results.push("middle");
        emitter.emit("end");
      });

      emitter.on("end", () => {
        results.push("end");
      });

      await emitter.emit("start");

      expect(results).toEqual(["start", "middle", "end"]);
    });

    it("should allow self-unsubscription during emit", async () => {
      const persistentHandler = vi.fn();

      const selfRemovingHandler = vi.fn(() => emitter.off("test", selfRemovingHandler));

      emitter.on("test", selfRemovingHandler);
      emitter.on("test", persistentHandler);

      // First emit - both handlers called
      await emitter.emit("test");
      expect(selfRemovingHandler).toHaveBeenCalledTimes(1);
      expect(persistentHandler).toHaveBeenCalledTimes(1);

      // Second emit - only persistent handler remains
      await emitter.emit("test");
      expect(selfRemovingHandler).toHaveBeenCalledTimes(1); // Still 1
      expect(persistentHandler).toHaveBeenCalledTimes(2);
    });
  });
});

