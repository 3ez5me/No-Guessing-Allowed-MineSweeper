// export type EventHandler = (...args: any[]) => void | Promise<void>;
// export type EventHandler = (...args: any[]) => any | Promise<any>;

export type EventHandler<T extends any[] = any[]> = (...args: T) => any | Promise<any>;

