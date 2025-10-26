export const bindMethod = <T, K extends keyof T>(
  obj: T,
  method: K,
): T[K] extends (...args: any[]) => any ? T[K] : never => {
  const boundMethod = (obj[method] as any).bind(obj);
  return boundMethod;
};
