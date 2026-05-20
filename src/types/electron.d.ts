export {};

declare global {
  interface Window {
    nex?: {
      invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
      openPath: (path: string) => Promise<void>;
      window: {
        minimize: () => Promise<void>;
        toggleMaximize: () => Promise<void>;
        close: () => Promise<void>;
        isMaximized: () => Promise<boolean>;
      };
      onEvent: <T>(eventName: string, callback: (payload: T) => void) => () => void;
    };
  }
}
