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
      beta_testers: {
        Row: {
          email: string;
          role: "tester" | "admin";
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          email: string;
          role?: "tester" | "admin";
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          role?: "tester" | "admin";
          is_active?: boolean;
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
          query_text: string | null;
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
          query_text?: string | null;
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
          query_text?: string | null;
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
    };
    Views: Record<string, never>;
    Functions: {
      consume_reading_quota: {
        Args: {
          p_email: string;
          p_user_id: string;
          p_ip_hash: string;
          p_email_daily_limit: number;
          p_ip_minute_limit: number;
          p_ip_daily_limit: number;
          p_daily_cost_limit_usd: number;
          p_cost_reservation_usd: number;
        };
        Returns: Json;
      };
      consume_encyclopedia_quota: {
        Args: {
          p_email: string;
          p_user_id: string;
          p_ip_hash: string;
          p_email_daily_limit: number;
          p_ip_minute_limit: number;
          p_ip_daily_limit: number;
          p_daily_cost_limit_usd: number;
          p_cost_reservation_usd: number;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
