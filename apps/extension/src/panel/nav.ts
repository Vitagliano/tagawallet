import { createContext, useContext } from "react";
import type { Route } from "../lib/messages";

/** Lets any row open a wallet or contact on top of the tabs, without threading callbacks through every view. */
export const Nav = createContext<{ go: (r: Route) => void }>({ go: () => {} });
export const useNav = () => useContext(Nav);
