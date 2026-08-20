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
          request_id: string | null;
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
          agent_trace: Json | null;
          agent_trace_schema_version: number | null;
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
          request_id?: string | null;
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
          agent_trace?: Json | null;
          agent_trace_schema_version?: number | null;
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
          request_id?: string | null;
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
          agent_trace?: Json | null;
          agent_trace_schema_version?: number | null;
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
          user_id: string | null;
          email: string | null;
          ip_hash: string;
          labels: string[];
          note: string | null;
          replay_consent: boolean;
          consent_version: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          reading_id: string;
          user_id?: string | null;
          email?: string | null;
          ip_hash: string;
          labels: string[];
          note?: string | null;
          replay_consent?: boolean;
          consent_version?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          reading_id?: string;
          user_id?: string | null;
          email?: string | null;
          ip_hash?: string;
          labels?: string[];
          note?: string | null;
          replay_consent?: boolean;
          consent_version?: string | null;
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
          thread_id: string | null;
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
          thread_id?: string | null;
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
          thread_id?: string | null;
        };
        Relationships: [];
      };
      growth_events: {
        Row: {
          event_id: string;
          created_at: string;
          event_type: "page_view" | "reading_started" | "reading_completed" | "feedback_submitted";
          session_id: string;
          attribution_id: string;
          flow_id: string | null;
          reading_id: string | null;
          user_id: string | null;
          ip_hash: string;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          utm_content: string | null;
          utm_term: string | null;
          landing_path: string;
          referrer_host: string | null;
        };
        Insert: {
          event_id: string;
          created_at?: string;
          event_type: "page_view" | "reading_started" | "reading_completed" | "feedback_submitted";
          session_id: string;
          attribution_id: string;
          flow_id?: string | null;
          reading_id?: string | null;
          user_id?: string | null;
          ip_hash: string;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_term?: string | null;
          landing_path: string;
          referrer_host?: string | null;
        };
        Update: {
          event_id?: string;
          created_at?: string;
          event_type?: "page_view" | "reading_started" | "reading_completed" | "feedback_submitted";
          session_id?: string;
          attribution_id?: string;
          flow_id?: string | null;
          reading_id?: string | null;
          user_id?: string | null;
          ip_hash?: string;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_term?: string | null;
          landing_path?: string;
          referrer_host?: string | null;
        };
        Relationships: [];
      };
      reading_thread_memories: {
        Row: {
          user_id: string;
          thread_id: string;
          memory: Json;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          thread_id: string;
          memory?: Json;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          thread_id?: string;
          memory?: Json;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reading_initial_snapshots: {
        Row: {
          id: string;
          subject_key: string;
          initial_reading_id: string;
          request_id: string;
          question: string;
          spread_id: string;
          drawn_cards: Json;
          profile: Json;
          draw_source: string;
          thread_id: string | null;
          continuity_context: string | null;
          initial_reading: Json;
          follow_up_questions: Json;
          created_at: string;
          expires_at: string;
          claim_request_id: string | null;
          claim_expires_at: string | null;
        };
        Insert: {
          id?: string;
          subject_key: string;
          initial_reading_id: string;
          request_id: string;
          question: string;
          spread_id: string;
          drawn_cards: Json;
          profile: Json;
          draw_source: string;
          thread_id?: string | null;
          continuity_context?: string | null;
          initial_reading: Json;
          follow_up_questions?: Json;
          created_at?: string;
          expires_at?: string;
          claim_request_id?: string | null;
          claim_expires_at?: string | null;
        };
        Update: {
          id?: string;
          subject_key?: string;
          initial_reading_id?: string;
          request_id?: string;
          question?: string;
          spread_id?: string;
          drawn_cards?: Json;
          profile?: Json;
          draw_source?: string;
          thread_id?: string | null;
          continuity_context?: string | null;
          initial_reading?: Json;
          follow_up_questions?: Json;
          created_at?: string;
          expires_at?: string;
          claim_request_id?: string | null;
          claim_expires_at?: string | null;
        };
        Relationships: [];
      };
      reading_request_executions: {
        Row: {
          subject_key: string;
          request_id: string;
          payload_hash: string;
          status: "processing" | "succeeded";
          lease_owner: string;
          lease_expires_at: string;
          response_status: number | null;
          response_payload: Json | null;
          created_at: string;
          updated_at: string;
          expires_at: string;
        };
        Insert: {
          subject_key: string;
          request_id: string;
          payload_hash: string;
          status: "processing" | "succeeded";
          lease_owner: string;
          lease_expires_at: string;
          response_status?: number | null;
          response_payload?: Json | null;
          created_at?: string;
          updated_at?: string;
          expires_at: string;
        };
        Update: {
          subject_key?: string;
          request_id?: string;
          payload_hash?: string;
          status?: "processing" | "succeeded";
          lease_owner?: string;
          lease_expires_at?: string;
          response_status?: number | null;
          response_payload?: Json | null;
          created_at?: string;
          updated_at?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      consume_growth_event_quota: {
        Args: {
          p_ip_hash: string;
          p_ip_minute_limit: number;
        };
        Returns: boolean;
      };
      consume_anonymous_reading_quota: {
        Args: {
          p_ip_hash: string;
          p_anonymous_daily_limit: number;
          p_ip_minute_limit: number;
        };
        Returns: Json;
      };
      consume_anonymous_reading_phase_quota: {
        Args: {
          p_ip_hash: string;
          p_anonymous_daily_limit: number;
          p_ip_minute_limit: number;
          p_charge_daily_quota: boolean;
        };
        Returns: Json;
      };
      consume_anonymous_encyclopedia_quota: {
        Args: {
          p_ip_hash: string;
          p_anonymous_daily_limit: number;
          p_ip_minute_limit: number;
        };
        Returns: Json;
      };
      consume_reading_quota: {
        Args: {
          p_user_id: string;
          p_ip_hash: string;
          p_user_daily_limit: number;
          p_ip_minute_limit: number;
        };
        Returns: Json;
      };
      consume_reading_phase_quota: {
        Args: {
          p_user_id: string;
          p_ip_hash: string;
          p_user_daily_limit: number;
          p_ip_minute_limit: number;
          p_charge_daily_quota: boolean;
        };
        Returns: Json;
      };
      refund_reading_daily_quota: {
        Args: {
          p_user_id: string | null;
          p_ip_hash: string;
        };
        Returns: Json;
      };
      merge_reading_thread_memory: {
        Args: {
          p_user_id: string;
          p_thread_id: string;
          p_patch: Json;
        };
        Returns: Json;
      };
      claim_reading_initial_snapshot: {
        Args: {
          p_subject_key: string;
          p_initial_reading_id: string;
          p_request_id: string;
          p_lease_seconds?: number;
        };
        Returns: Json;
      };
      release_reading_initial_snapshot: {
        Args: {
          p_subject_key: string;
          p_initial_reading_id: string;
          p_request_id: string;
        };
        Returns: boolean;
      };
      consume_reading_initial_snapshot: {
        Args: {
          p_subject_key: string;
          p_initial_reading_id: string;
          p_request_id: string;
        };
        Returns: boolean;
      };
      claim_reading_request_execution: {
        Args: {
          p_subject_key: string;
          p_request_id: string;
          p_payload_hash: string;
          p_lease_owner: string;
          p_lease_seconds?: number;
        };
        Returns: Json;
      };
      complete_reading_request_execution: {
        Args: {
          p_subject_key: string;
          p_request_id: string;
          p_lease_owner: string;
          p_response_status: number;
          p_response_payload: Json;
        };
        Returns: boolean;
      };
      release_reading_request_execution: {
        Args: {
          p_subject_key: string;
          p_request_id: string;
          p_lease_owner: string;
        };
        Returns: boolean;
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
      reserve_daily_safety_reviewer_tokens: {
        Args: {
          p_source: "safety_input" | "safety_output";
          p_requested_tokens: number;
          p_daily_limit: number;
        };
        Returns: Json;
      };
      settle_daily_safety_reviewer_tokens: {
        Args: {
          p_reservation_id: string;
          p_actual_tokens: number;
        };
        Returns: Json;
      };
      consume_safety_reviewer_subject_quota: {
        Args: {
          p_subject_key: string;
          p_limit_per_minute: number;
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
