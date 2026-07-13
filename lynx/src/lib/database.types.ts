// Hand-maintained Supabase schema types.
// `supabase gen types` requires a local Docker daemon (postgres-meta container),
// which isn't available here, so we keep this in sync with supabase/migrations by hand.
// Shape mirrors the Supabase codegen output so we can switch to generation later.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          theme: string;
          accent: string;
          ai_enabled: boolean;
          startup_preference: string;
          note_grouping: string;
          ai_provider: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          theme?: string;
          accent?: string;
          ai_enabled?: boolean;
          startup_preference?: string;
          note_grouping?: string;
          ai_provider?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          theme?: string;
          accent?: string;
          ai_enabled?: boolean;
          startup_preference?: string;
          note_grouping?: string;
          ai_provider?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_activity_log: {
        Row: {
          id: string;
          user_id: string;
          note_id: string | null;
          action: string;
          input_preview: string;
          output_preview: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          note_id?: string | null;
          action: string;
          input_preview?: string;
          output_preview?: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          note_id?: string | null;
          action?: string;
          input_preview?: string;
          output_preview?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      reminders: {
        Row: {
          id: string;
          user_id: string;
          note_id: string;
          remind_at: string;
          message: string;
          recurrence: string;
          done: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          note_id: string;
          remind_at: string;
          message?: string;
          recurrence?: string;
          done?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          note_id?: string;
          remind_at?: string;
          message?: string;
          recurrence?: string;
          done?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          icon: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          color?: string;
          icon?: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
          icon?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content: Json;
          content_text: string;
          category_id: string | null;
          pinned: boolean;
          archived: boolean;
          daily_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: Json;
          content_text?: string;
          category_id?: string | null;
          pinned?: boolean;
          archived?: boolean;
          daily_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: Json;
          content_text?: string;
          category_id?: string | null;
          pinned?: boolean;
          archived?: boolean;
          daily_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      links: {
        Row: {
          id: string;
          user_id: string;
          url: string;
          title: string;
          description: string;
          image_url: string;
          note: string;
          category_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          url: string;
          title?: string;
          description?: string;
          image_url?: string;
          note?: string;
          category_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          url?: string;
          title?: string;
          description?: string;
          image_url?: string;
          note?: string;
          category_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      attachments: {
        Row: {
          id: string;
          user_id: string;
          note_id: string;
          storage_path: string;
          caption: string;
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          note_id: string;
          storage_path: string;
          caption?: string;
          description?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          note_id?: string;
          storage_path?: string;
          caption?: string;
          description?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
