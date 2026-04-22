export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      group_competitions: {
        Row: {
          created_at: string | null
          created_by: string | null
          ends_at: string
          group_id: string
          id: string
          metric: string
          name: string
          starts_at: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          ends_at: string
          group_id: string
          id?: string
          metric?: string
          name: string
          starts_at: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          ends_at?: string
          group_id?: string
          id?: string
          metric?: string
          name?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_competitions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_events: {
        Row: {
          actor: string | null
          created_at: string | null
          event_type: string
          group_id: string
          id: string
          metadata: Json | null
          target: string | null
        }
        Insert: {
          actor?: string | null
          created_at?: string | null
          event_type: string
          group_id: string
          id?: string
          metadata?: Json | null
          target?: string | null
        }
        Update: {
          actor?: string | null
          created_at?: string | null
          event_type?: string
          group_id?: string
          id?: string
          metadata?: Json | null
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_join_requests: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          message: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          username: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          username: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_join_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string | null
          rank_icon_id: string | null
          rank_slot: number | null
          role: string
          username: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string | null
          rank_icon_id?: string | null
          rank_slot?: number | null
          role?: string
          username: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string | null
          rank_icon_id?: string | null
          rank_slot?: number | null
          role?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          banner_url: string | null
          bot_state: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          discord_verified: boolean | null
          discord_webhook_url: string | null
          id: string
          is_private: boolean | null
          name: string
          rank_icons: Json | null
          rank_titles: Json | null
          slug: string
        }
        Insert: {
          banner_url?: string | null
          bot_state?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discord_verified?: boolean | null
          discord_webhook_url?: string | null
          id?: string
          is_private?: boolean | null
          name: string
          rank_icons?: Json | null
          rank_titles?: Json | null
          slug: string
        }
        Update: {
          banner_url?: string | null
          bot_state?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discord_verified?: boolean | null
          discord_webhook_url?: string | null
          id?: string
          is_private?: boolean | null
          name?: string
          rank_icons?: Json | null
          rank_titles?: Json | null
          slug?: string
        }
        Relationships: []
      }
      player_screenshots: {
        Row: {
          created_at: string
          id: string
          player_username: string
          public_url: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_username: string
          public_url: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          player_username?: string
          public_url?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_screenshots_player_username_fkey"
            columns: ["player_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      player_snapshots: {
        Row: {
          created_at: string | null
          id: string
          overall_rank: number
          player_username: string
          snapshot_data: Json
          total_level: number
          total_xp: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          overall_rank?: number
          player_username: string
          snapshot_data: Json
          total_level?: number
          total_xp?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          overall_rank?: number
          player_username?: string
          snapshot_data?: Json
          total_level?: number
          total_xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_snapshots_player_username_fkey"
            columns: ["player_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      players: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string | null
          display_name: string
          first_tracked_at: string | null
          game_mode: string
          id: string
          last_fetched_at: string | null
          overall_rank: number
          total_level: number
          total_xp: number
          updated_at: string | null
          username: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          display_name: string
          first_tracked_at?: string | null
          game_mode?: string
          id?: string
          last_fetched_at?: string | null
          overall_rank?: number
          total_level?: number
          total_xp?: number
          updated_at?: string | null
          username: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          display_name?: string
          first_tracked_at?: string | null
          game_mode?: string
          id?: string
          last_fetched_at?: string | null
          overall_rank?: number
          total_level?: number
          total_xp?: number
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      trade_history: {
        Row: {
          created_at: string
          id: number
          item_id: number
          item_name: string
          price_each: number
          quantity: number
          source: string
          total_value: number
          traded_at: string
          type: string | null
        }
        Insert: {
          created_at?: string
          id: number
          item_id: number
          item_name: string
          price_each: number
          quantity: number
          source: string
          total_value: number
          traded_at: string
          type?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          item_id?: number
          item_name?: string
          price_each?: number
          quantity?: number
          source?: string
          total_value?: number
          traded_at?: string
          type?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          is_admin: boolean
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          is_admin?: boolean
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_admin?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
