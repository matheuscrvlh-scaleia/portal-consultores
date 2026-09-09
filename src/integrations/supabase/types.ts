export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      areas: {
        Row: {
          created_at: string;
          descricao: string | null;
          id: string;
          nome: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          descricao?: string | null;
          id?: string;
          nome: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          descricao?: string | null;
          id?: string;
          nome?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      buscas: {
        Row: {
          area_id: string | null;
          criado_em: string;
          id: string;
          termo: string | null;
        };
        Insert: {
          area_id?: string | null;
          criado_em?: string;
          id?: string;
          termo?: string | null;
        };
        Update: {
          area_id?: string | null;
          criado_em?: string;
          id?: string;
          termo?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "buscas_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id"];
          },
        ];
      };
      cases: {
        Row: {
          cliente: string;
          consultor_id: string;
          created_at: string;
          descricao: string | null;
          id: string;
          ordem: number;
          resultado: string | null;
          updated_at: string;
        };
        Insert: {
          cliente: string;
          consultor_id: string;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          ordem?: number;
          resultado?: string | null;
          updated_at?: string;
        };
        Update: {
          cliente?: string;
          consultor_id?: string;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          ordem?: number;
          resultado?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cases_consultor_id_fkey";
            columns: ["consultor_id"];
            isOneToOne: false;
            referencedRelation: "consultores";
            referencedColumns: ["id"];
          },
        ];
      };
      consultor_areas: {
        Row: {
          area_id: string;
          consultor_id: string;
          created_at: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          area_id: string;
          consultor_id: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          area_id?: string;
          consultor_id?: string;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consultor_areas_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consultor_areas_consultor_id_fkey";
            columns: ["consultor_id"];
            isOneToOne: false;
            referencedRelation: "consultores";
            referencedColumns: ["id"];
          },
        ];
      };
      consultores: {
        Row: {
          bio: string | null;
          created_at: string;
          email: string;
          foto_path: string | null;
          id: string;
          nome: string;
          ordem: number;
          publicado: boolean;
          redes: Json;
          slug: string;
          telefone: string | null;
          tempo_de_mercado: number | null;
          updated_at: string;
          user_id: string | null;
          video_path: string | null;
        };
        Insert: {
          bio?: string | null;
          created_at?: string;
          email: string;
          foto_path?: string | null;
          id?: string;
          nome: string;
          ordem?: number;
          publicado?: boolean;
          redes?: Json;
          slug: string;
          telefone?: string | null;
          tempo_de_mercado?: number | null;
          updated_at?: string;
          user_id?: string | null;
          video_path?: string | null;
        };
        Update: {
          bio?: string | null;
          created_at?: string;
          email?: string;
          foto_path?: string | null;
          id?: string;
          nome?: string;
          ordem?: number;
          publicado?: boolean;
          redes?: Json;
          slug?: string;
          telefone?: string | null;
          tempo_de_mercado?: number | null;
          updated_at?: string;
          user_id?: string | null;
          video_path?: string | null;
        };
        Relationships: [];
      };
      contato_rate_limit: {
        Row: {
          contagem: number;
          created_at: string;
          id: string;
          ip_hash: string;
          janela_inicio: string;
          updated_at: string;
        };
        Insert: {
          contagem?: number;
          created_at?: string;
          id?: string;
          ip_hash: string;
          janela_inicio: string;
          updated_at?: string;
        };
        Update: {
          contagem?: number;
          created_at?: string;
          id?: string;
          ip_hash?: string;
          janela_inicio?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      conteudos: {
        Row: {
          area_id: string | null;
          consultor_id: string;
          created_at: string;
          descricao: string | null;
          id: string;
          poster_path: string | null;
          publicado: boolean;
          slug: string;
          tipo: Database["public"]["Enums"]["conteudo_tipo"];
          titulo: string;
          updated_at: string;
          video_path: string | null;
        };
        Insert: {
          area_id?: string | null;
          consultor_id: string;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          poster_path?: string | null;
          publicado?: boolean;
          slug: string;
          tipo: Database["public"]["Enums"]["conteudo_tipo"];
          titulo: string;
          updated_at?: string;
          video_path?: string | null;
        };
        Update: {
          area_id?: string | null;
          consultor_id?: string;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          poster_path?: string | null;
          publicado?: boolean;
          slug?: string;
          tipo?: Database["public"]["Enums"]["conteudo_tipo"];
          titulo?: string;
          updated_at?: string;
          video_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "conteudos_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conteudos_consultor_id_fkey";
            columns: ["consultor_id"];
            isOneToOne: false;
            referencedRelation: "consultores";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          consultor_id: string | null;
          created_at: string;
          email: string;
          empresa: string | null;
          id: string;
          mensagem: string | null;
          nome: string;
          origem: string | null;
          status: Database["public"]["Enums"]["lead_status"];
          telefone: string | null;
          updated_at: string;
        };
        Insert: {
          consultor_id?: string | null;
          created_at?: string;
          email: string;
          empresa?: string | null;
          id?: string;
          mensagem?: string | null;
          nome: string;
          origem?: string | null;
          status?: Database["public"]["Enums"]["lead_status"];
          telefone?: string | null;
          updated_at?: string;
        };
        Update: {
          consultor_id?: string | null;
          created_at?: string;
          email?: string;
          empresa?: string | null;
          id?: string;
          mensagem?: string | null;
          nome?: string;
          origem?: string | null;
          status?: Database["public"]["Enums"]["lead_status"];
          telefone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leads_consultor_id_fkey";
            columns: ["consultor_id"];
            isOneToOne: false;
            referencedRelation: "consultores";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      usuarios: {
        Row: {
          consentimento_lgpd_em: string | null;
          consentimento_lgpd_versao: string | null;
          created_at: string;
          email: string;
          id: string;
          nome: string;
          telefone: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          consentimento_lgpd_em?: string | null;
          consentimento_lgpd_versao?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          nome: string;
          telefone?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          consentimento_lgpd_em?: string | null;
          consentimento_lgpd_versao?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          nome?: string;
          telefone?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      visualizacoes: {
        Row: {
          conteudo_id: string;
          criado_em: string;
          id: string;
          usuario_id: string;
        };
        Insert: {
          conteudo_id: string;
          criado_em?: string;
          id?: string;
          usuario_id: string;
        };
        Update: {
          conteudo_id?: string;
          criado_em?: string;
          id?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "visualizacoes_conteudo_id_fkey";
            columns: ["conteudo_id"];
            isOneToOne: false;
            referencedRelation: "conteudos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visualizacoes_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_metricas_buscas_por_area: {
        Args: { _fim: string; _inicio: string };
        Returns: {
          area_id: string;
          area_nome: string;
          total: number;
        }[];
      };
      admin_metricas_cadastros_por_dia: {
        Args: { _fim: string; _inicio: string };
        Returns: {
          dia: string;
          total: number;
        }[];
      };
      admin_metricas_leads_por_consultor: {
        Args: { _fim: string; _inicio: string };
        Returns: {
          consultor_id: string;
          consultor_nome: string;
          fechados: number;
          taxa: number;
          total: number;
        }[];
      };
      admin_metricas_resumo: {
        Args: { _fim: string; _inicio: string };
        Returns: {
          buscas: number;
          cadastros: number;
          leads: number;
          leads_fechados: number;
        }[];
      };
      admin_metricas_termos: {
        Args: { _fim: string; _inicio: string; _limite?: number };
        Returns: {
          termo: string;
          total: number;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_consultor_owner: { Args: { _consultor_id: string }; Returns: boolean };
      is_consultor_publicado: {
        Args: { _consultor_id: string };
        Returns: boolean;
      };
      is_usuario_owner: { Args: { _usuario_id: string }; Returns: boolean };
      registrar_tentativa_contato: {
        Args: { _ip_hash: string; _limite?: number };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "consultor" | "visitante";
      conteudo_tipo: "video" | "texto";
      lead_status: "novo" | "em_contato" | "fechado" | "perdido";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "consultor", "visitante"],
      conteudo_tipo: ["video", "texto"],
      lead_status: ["novo", "em_contato", "fechado", "perdido"],
    },
  },
} as const;
