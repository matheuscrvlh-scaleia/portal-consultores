import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { getMyAccess } from "@/lib/auth.functions";

export const accessQueryKey = ["auth", "access"] as const;

/** Sessão atual do navegador, mantida em sincronia com o Supabase Auth. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

/** Papéis do usuário autenticado, resolvidos no servidor via `has_role`. */
export function useAccess() {
  const { session, loading } = useSession();

  const query = useQuery({
    queryKey: accessQueryKey,
    queryFn: () => getMyAccess(),
    enabled: Boolean(session),
    staleTime: 60_000,
  });

  return {
    session,
    loading: loading || (Boolean(session) && query.isLoading),
    access: session ? (query.data ?? null) : null,
  };
}

/** Encerra a sessão limpando o cache antes de navegar. */
export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}
