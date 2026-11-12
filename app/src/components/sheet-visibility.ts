import { createContext, useContext } from "react";

export const SheetVisibility = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({
  open: false,
  setOpen: () => {},
});

export function useSheetOpen() {
  return useContext(SheetVisibility).open;
}
