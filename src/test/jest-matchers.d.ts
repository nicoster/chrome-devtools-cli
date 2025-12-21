// Jest custom matchers type declarations
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidCDPMessage(): R;
      toBeValidCommandResult(): R;
    }
  }
}

export {};