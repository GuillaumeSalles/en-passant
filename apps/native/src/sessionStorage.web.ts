// The browser owns its HttpOnly cookie; never persist credentials in localStorage.
export const sessionStorage = {
  read: async (): Promise<string | null> => null,
  write: async (_cookie: string): Promise<void> => {},
  clear: async (): Promise<void> => {},
};
