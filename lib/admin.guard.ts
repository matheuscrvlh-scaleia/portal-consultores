/** Guardas e helpers usados pelas server functions administrativas. */

type MinimalClient = {
  rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => Promise<{ data: unknown }>;
};

/** Garante que o usuário autenticado tem o papel `admin`. */
export async function requireAdmin(supabase: MinimalClient, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden");
}
