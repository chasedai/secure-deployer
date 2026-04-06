import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { getServers, type Server } from "./api";

interface ServerCtx {
  servers: Server[];
  selectedId: string | null;
  selected: Server | null;
  setSelectedId: (id: string | null) => void;
  refresh: () => Promise<void>;
}

const ServerContext = createContext<ServerCtx>({
  servers: [],
  selectedId: null,
  selected: null,
  setSelectedId: () => {},
  refresh: async () => {},
});

export function ServerProvider({ children }: { children: ReactNode }) {
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedId, setSelectedIdState] = useState<string | null>(
    () => localStorage.getItem("sd_server") || null
  );

  const refresh = useCallback(async () => {
    try {
      const { servers: list } = await getServers();
      setServers(list);
      if (list.length > 0 && (!selectedId || !list.find((s) => s.id === selectedId))) {
        const first = list[0].id;
        setSelectedIdState(first);
        localStorage.setItem("sd_server", first);
      }
    } catch {}
  }, [selectedId]);

  useEffect(() => { refresh(); }, []);

  const setSelectedId = useCallback((id: string | null) => {
    setSelectedIdState(id);
    if (id) localStorage.setItem("sd_server", id);
    else localStorage.removeItem("sd_server");
  }, []);

  const selected = servers.find((s) => s.id === selectedId) || null;

  return (
    <ServerContext.Provider value={{ servers, selectedId, selected, setSelectedId, refresh }}>
      {children}
    </ServerContext.Provider>
  );
}

export function useServer() {
  return useContext(ServerContext);
}
