export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      app_users: {
        Row: {
          id: string;
          auth_provider: "credentials";
          auth_subject: string;
          email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_provider: "credentials";
          auth_subject: string;
          email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_provider?: "keycloak";
          auth_subject?: string;
          email?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      beta_testers: {
        Row: {
          email: string;
          role: "tester" | "admin";
          is_active: boolean;
          password_hash: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          email: string;
          role?: "tester" | "admin";
          is_active?: boolean;
          password_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          role?: "tester" | "admin";
          is_active?: boolean;
          password_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      usage_counters: {
        Row: {
          counter_key: string;
          counter_type: string;
          window_start: string;
          count_value: number;
          cost_value_usd: number;
          updated_at: string;
        };
        Insert: {
          counter_key: string;
          counter_type: string;
          window_start: string;
          count_value?: number;
          cost_value_usd?: number;
          updated_at?: string;
        };
        Update: {
          counter_key?: string;
          counter_type?: string;
          window_start?: string;
          count_value?: number;
          cost_value_usd?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      llm_daily_token_usage: {
        Row: {
          usage_day: string;
          consumed_tokens: number;
          outstanding_reserved_tokens: number;
          updated_at: string;
        };
        Insert: {
          usage_day: string;
          consumed_tokens?: number;
          outstanding_reserved_tokens?: number;
          updated_at?: string;
        };
        Update: {
          usage_day?: string;
          consumed_tokens?: number;
          outstanding_reserved_tokens?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      llm_token_reservations: {
        Row: {
          id: string;
          usage_day: string;
          source: "reading" | "encyclopedia";
          reserved_tokens: number;
          settled_tokens: number | null;
          status: "reserved" | "settled";
          created_at: string;
          settled_at: string | null;
        };
        Insert: {
          id?: string;
          usage_day: string;
          source: "reading" | "encyclopedia";
          reserved_tokens: number;
          settled_tokens?: number | null;
          status?: "reserved" | "settled";
          created_at?: string;
          settled_at?: string | null;
        };
        Update: {
          id?: string;
          usage_day?: string;
          source?: "reading" | "encyclopedia";
          reserved_tokens?: number;
          settled_tokens?: number | null;
          status?: "reserved" | "settled";
          created_at?: string;
          settled_at?: string | null;
        };
        Relationships: [];
      };
      auth_email_events: {
        Row: {
          id: string;
          created_at: string;
          email: string | null;
          ip_hash: string;
          status: "success" | "failure";
          error_code: string | null;
          duration_ms: number;
        };
        Insert: {
          id?: string;
          created_at?: string;
          email?: string | null;
          ip_hash: string;
          status: "success" | "failure";
          error_code?: string | null;
          duration_ms?: number;
        };
        Update: {
          id?: string;
          created_at?: string;
          email?: string | null;
          ip_hash?: string;
          status?: "success" | "failure";
          error_code?: string | null;
          duration_ms?: number;
        };
        Relationships: [];
      };
      reading_events: {
        Row: {
          id: string;
          created_at: string;
          user_id: string | null;
          email: string | null;
          ip_hash: string;
          provider: string;
          phase: "initial" | "final" | null;
          spread_id: string | null;
          reading_id: string | null;
          initial_reading_id: string | null;
          status: "success" | "failure";
          error_code: string | null;
          duration_ms: number;
          llm_duration_ms: number;
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
          estimated_cost_usd: number;
          completed_initial: boolean;
          completed_final: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id?: string | null;
          email?: string | null;
          ip_hash: string;
          provider: string;
          phase?: "initial" | "final" | null;
          spread_id?: string | null;
          reading_id?: string | null;
          initial_reading_id?: string | null;
          status: "success" | "failure";
          error_code?: string | null;
          duration_ms?: number;
          llm_duration_ms?: number;
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          estimated_cost_usd?: number;
          completed_initial?: boolean;
          completed_final?: boolean;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string | null;
          email?: string | null;
          ip_hash?: string;
          provider?: string;
          phase?: "initial" | "final" | null;
          spread_id?: string | null;
          reading_id?: string | null;
          initial_reading_id?: string | null;
          status?: "success" | "failure";
          error_code?: string | null;
          duration_ms?: number;
          llm_duration_ms?: number;
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          estimated_cost_usd?: number;
          completed_initial?: boolean;
          completed_final?: boolean;
        };
        Relationships: [];
      };
      encyclopedia_events: {
        Row: {
          id: string;
          created_at: string;
          user_id: string | null;
          email: string | null;
          ip_hash: string;
          provider: string;
          card_id: string | null;
          source_count: number;
          status: "success" | "failure";
          error_code: string | null;
          duration_ms: number;
          llm_duration_ms: number;
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
          estimated_cost_usd: number;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id?: string | null;
          email?: string | null;
          ip_hash: string;
          provider: string;
          card_id?: string | null;
          source_count?: number;
          status: "success" | "failure";
          error_code?: string | null;
          duration_ms?: number;
          llm_duration_ms?: number;
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          estimated_cost_usd?: number;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string | null;
          email?: string | null;
          ip_hash?: string;
          provider?: string;
          card_id?: string | null;
          source_count?: number;
          status?: "success" | "failure";
          error_code?: string | null;
          duration_ms?: number;
          llm_duration_ms?: number;
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          estimated_cost_usd?: number;
        };
        Relationships: [];
      };
      reading_feedback: {
        Row: {
          id: string;
          created_at: string;
          reading_id: string;
          user_id: string;
          email: string;
          ip_hash: string;
          labels: string[];
          note: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          reading_id: string;
          user_id: string;
          email: string;
          ip_hash: string;
          labels: string[];
          note?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          reading_id?: string;
          user_id?: string;
          email?: string;
          ip_hash?: string;
          labels?: string[];
          note?: string | null;
        };
        Relationships: [];
      };
      stored_readings: {
        Row: {
          id: string;
          user_id: string;
          reading_id: string;
          created_at: string;
          spread_id: string;
          draw_source: string | null;
          drawn_cards: Json;
          reading: Json;
          user_notes: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          reading_id: string;
          created_at?: string;
          spread_id: string;
          draw_source?: string | null;
          drawn_cards?: Json;
          reading: Json;
          user_notes?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          reading_id?: string;
          created_at?: string;
          spread_id?: string;
          draw_source?: string | null;
          drawn_cards?: Json;
          reading?: Json;
          user_notes?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      consume_reading_quota: {
        Args: {
          p_user_id: string;
          p_ip_hash: string;
          p_user_daily_limit: number;
          p_ip_minute_limit: number;
        };
        Returns: Json;
      };
      consume_encyclopedia_quota: {
        Args: {
          p_user_id: string;
          p_ip_hash: string;
          p_user_daily_limit: number;
          p_ip_minute_limit: number;
        };
        Returns: Json;
      };
      reserve_daily_llm_tokens: {
        Args: {
          p_source: "reading" | "encyclopedia";
          p_requested_tokens: number;
          p_daily_limit: number;
        };
        Returns: Json;
      };
      settle_daily_llm_tokens: {
        Args: {
          p_reservation_id: string;
          p_actual_tokens: number;
        };
        Returns: Json;
      };
      consume_auth_email_quota: {
        Args: {
          p_email: string;
          p_ip_hash: string;
          p_email_hourly_limit: number;
          p_email_daily_limit: number;
          p_ip_hourly_limit: number;
          p_global_hourly_limit: number;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
