import { create } from "zustand";

interface LogoutStore {
  isLoggingOut: boolean;
  setLoggingOut: (v: boolean) => void;
}

export const useLogoutStore = create<LogoutStore>((set) => ({
  isLoggingOut: false,
  setLoggingOut: (v) => set({ isLoggingOut: v }),
}));
