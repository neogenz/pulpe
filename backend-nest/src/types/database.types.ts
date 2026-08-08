export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      budget_line: {
        Row: {
          amount: string | null;
          budget_id: string;
          checked_at: string | null;
          created_at: string;
          exchange_rate: number | null;
          id: string;
          is_manually_adjusted: boolean;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          original_amount: string | null;
          original_currency: string | null;
          recurrence: Database['public']['Enums']['transaction_recurrence'];
          savings_goal_id: string | null;
          savings_withdrawal_group_id: string | null;
          source_savings_goal_id: string | null;
          source_savings_goal_name: string | null;
          spread_group_id: string | null;
          target_currency: string | null;
          template_line_id: string | null;
          updated_at: string;
        };
        Insert: {
          amount?: string | null;
          budget_id: string;
          checked_at?: string | null;
          created_at?: string;
          exchange_rate?: number | null;
          id?: string;
          is_manually_adjusted?: boolean;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          original_amount?: string | null;
          original_currency?: string | null;
          recurrence: Database['public']['Enums']['transaction_recurrence'];
          savings_goal_id?: string | null;
          savings_withdrawal_group_id?: string | null;
          source_savings_goal_id?: string | null;
          source_savings_goal_name?: string | null;
          spread_group_id?: string | null;
          target_currency?: string | null;
          template_line_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: string | null;
          budget_id?: string;
          checked_at?: string | null;
          created_at?: string;
          exchange_rate?: number | null;
          id?: string;
          is_manually_adjusted?: boolean;
          kind?: Database['public']['Enums']['transaction_kind'];
          name?: string;
          original_amount?: string | null;
          original_currency?: string | null;
          recurrence?: Database['public']['Enums']['transaction_recurrence'];
          savings_goal_id?: string | null;
          savings_withdrawal_group_id?: string | null;
          source_savings_goal_id?: string | null;
          source_savings_goal_name?: string | null;
          spread_group_id?: string | null;
          target_currency?: string | null;
          template_line_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'budget_line_budget_id_fkey';
            columns: ['budget_id'];
            isOneToOne: false;
            referencedRelation: 'monthly_budget';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'budget_line_savings_goal_id_fkey';
            columns: ['savings_goal_id'];
            isOneToOne: false;
            referencedRelation: 'savings_goal';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'budget_line_source_savings_goal_id_fkey';
            columns: ['source_savings_goal_id'];
            isOneToOne: false;
            referencedRelation: 'savings_goal';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'budget_line_template_line_id_fkey';
            columns: ['template_line_id'];
            isOneToOne: false;
            referencedRelation: 'template_line';
            referencedColumns: ['id'];
          },
        ];
      };
      budget_line_tag: {
        Row: {
          budget_line_id: string;
          created_at: string;
          tag_id: string;
        };
        Insert: {
          budget_line_id: string;
          created_at?: string;
          tag_id: string;
        };
        Update: {
          budget_line_id?: string;
          created_at?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'budget_line_tag_budget_line_id_fkey';
            columns: ['budget_line_id'];
            isOneToOne: false;
            referencedRelation: 'budget_line';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'budget_line_tag_tag_id_fkey';
            columns: ['tag_id'];
            isOneToOne: false;
            referencedRelation: 'tag';
            referencedColumns: ['id'];
          },
        ];
      };
      monthly_budget: {
        Row: {
          created_at: string;
          description: string;
          ending_balance: string | null;
          id: string;
          month: number;
          template_id: string;
          updated_at: string;
          user_id: string | null;
          year: number;
        };
        Insert: {
          created_at?: string;
          description: string;
          ending_balance?: string | null;
          id?: string;
          month: number;
          template_id: string;
          updated_at?: string;
          user_id?: string | null;
          year: number;
        };
        Update: {
          created_at?: string;
          description?: string;
          ending_balance?: string | null;
          id?: string;
          month?: number;
          template_id?: string;
          updated_at?: string;
          user_id?: string | null;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'budgets_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'template';
            referencedColumns: ['id'];
          },
        ];
      };
      savings_goal: {
        Row: {
          balance_revision: number;
          created_at: string;
          exchange_rate: number | null;
          id: string;
          initial_amount: string | null;
          name: string;
          original_currency: string | null;
          original_target_amount: string | null;
          priority: Database['public']['Enums']['priority_level'] | null;
          start_date: string | null;
          status: Database['public']['Enums']['savings_goal_status'];
          target_amount: string | null;
          target_currency: string | null;
          target_date: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          balance_revision?: number;
          created_at?: string;
          exchange_rate?: number | null;
          id?: string;
          initial_amount?: string | null;
          name: string;
          original_currency?: string | null;
          original_target_amount?: string | null;
          priority?: Database['public']['Enums']['priority_level'] | null;
          start_date?: string | null;
          status?: Database['public']['Enums']['savings_goal_status'];
          target_amount?: string | null;
          target_currency?: string | null;
          target_date?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          balance_revision?: number;
          created_at?: string;
          exchange_rate?: number | null;
          id?: string;
          initial_amount?: string | null;
          name?: string;
          original_currency?: string | null;
          original_target_amount?: string | null;
          priority?: Database['public']['Enums']['priority_level'] | null;
          start_date?: string | null;
          status?: Database['public']['Enums']['savings_goal_status'];
          target_amount?: string | null;
          target_currency?: string | null;
          target_date?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      savings_goal_plan_withdrawal: {
        Row: {
          amount: string;
          created_at: string;
          id: string;
          month: number;
          savings_goal_id: string;
          updated_at: string;
          user_id: string;
          year: number;
        };
        Insert: {
          amount: string;
          created_at?: string;
          id?: string;
          month: number;
          savings_goal_id: string;
          updated_at?: string;
          user_id: string;
          year: number;
        };
        Update: {
          amount?: string;
          created_at?: string;
          id?: string;
          month?: number;
          savings_goal_id?: string;
          updated_at?: string;
          user_id?: string;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'savings_goal_plan_withdrawal_savings_goal_id_fkey';
            columns: ['savings_goal_id'];
            isOneToOne: false;
            referencedRelation: 'savings_goal';
            referencedColumns: ['id'];
          },
        ];
      };
      tag: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      template: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_default: boolean;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      template_line: {
        Row: {
          amount: string | null;
          created_at: string;
          description: string | null;
          exchange_rate: number | null;
          id: string;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          original_amount: string | null;
          original_currency: string | null;
          recurrence: Database['public']['Enums']['transaction_recurrence'];
          savings_goal_id: string | null;
          target_currency: string | null;
          template_id: string;
          updated_at: string;
        };
        Insert: {
          amount?: string | null;
          created_at?: string;
          description?: string | null;
          exchange_rate?: number | null;
          id?: string;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          original_amount?: string | null;
          original_currency?: string | null;
          recurrence: Database['public']['Enums']['transaction_recurrence'];
          savings_goal_id?: string | null;
          target_currency?: string | null;
          template_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: string | null;
          created_at?: string;
          description?: string | null;
          exchange_rate?: number | null;
          id?: string;
          kind?: Database['public']['Enums']['transaction_kind'];
          name?: string;
          original_amount?: string | null;
          original_currency?: string | null;
          recurrence?: Database['public']['Enums']['transaction_recurrence'];
          savings_goal_id?: string | null;
          target_currency?: string | null;
          template_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'template_line_savings_goal_id_fkey';
            columns: ['savings_goal_id'];
            isOneToOne: false;
            referencedRelation: 'savings_goal';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'template_transactions_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'template';
            referencedColumns: ['id'];
          },
        ];
      };
      template_line_tag: {
        Row: {
          created_at: string;
          tag_id: string;
          template_line_id: string;
        };
        Insert: {
          created_at?: string;
          tag_id: string;
          template_line_id: string;
        };
        Update: {
          created_at?: string;
          tag_id?: string;
          template_line_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'template_line_tag_tag_id_fkey';
            columns: ['tag_id'];
            isOneToOne: false;
            referencedRelation: 'tag';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'template_line_tag_template_line_id_fkey';
            columns: ['template_line_id'];
            isOneToOne: false;
            referencedRelation: 'template_line';
            referencedColumns: ['id'];
          },
        ];
      };
      transaction: {
        Row: {
          amount: string | null;
          budget_id: string;
          budget_line_id: string | null;
          checked_at: string | null;
          created_at: string;
          exchange_rate: number | null;
          id: string;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          original_amount: string | null;
          original_currency: string | null;
          source_savings_goal_id: string | null;
          source_savings_goal_name: string | null;
          target_currency: string | null;
          transaction_date: string;
          updated_at: string;
        };
        Insert: {
          amount?: string | null;
          budget_id: string;
          budget_line_id?: string | null;
          checked_at?: string | null;
          created_at?: string;
          exchange_rate?: number | null;
          id?: string;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          original_amount?: string | null;
          original_currency?: string | null;
          source_savings_goal_id?: string | null;
          source_savings_goal_name?: string | null;
          target_currency?: string | null;
          transaction_date?: string;
          updated_at?: string;
        };
        Update: {
          amount?: string | null;
          budget_id?: string;
          budget_line_id?: string | null;
          checked_at?: string | null;
          created_at?: string;
          exchange_rate?: number | null;
          id?: string;
          kind?: Database['public']['Enums']['transaction_kind'];
          name?: string;
          original_amount?: string | null;
          original_currency?: string | null;
          source_savings_goal_id?: string | null;
          source_savings_goal_name?: string | null;
          target_currency?: string | null;
          transaction_date?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'transaction_budget_id_fkey';
            columns: ['budget_id'];
            isOneToOne: false;
            referencedRelation: 'monthly_budget';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transaction_budget_line_id_fkey';
            columns: ['budget_line_id'];
            isOneToOne: false;
            referencedRelation: 'budget_line';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transaction_source_savings_goal_id_fkey';
            columns: ['source_savings_goal_id'];
            isOneToOne: false;
            referencedRelation: 'savings_goal';
            referencedColumns: ['id'];
          },
        ];
      };
      transaction_tag: {
        Row: {
          created_at: string;
          tag_id: string;
          transaction_id: string;
        };
        Insert: {
          created_at?: string;
          tag_id: string;
          transaction_id: string;
        };
        Update: {
          created_at?: string;
          tag_id?: string;
          transaction_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'transaction_tag_tag_id_fkey';
            columns: ['tag_id'];
            isOneToOne: false;
            referencedRelation: 'tag';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transaction_tag_transaction_id_fkey';
            columns: ['transaction_id'];
            isOneToOne: false;
            referencedRelation: 'transaction';
            referencedColumns: ['id'];
          },
        ];
      };
      user_encryption_key: {
        Row: {
          created_at: string;
          kdf_iterations: number;
          key_check: string | null;
          salt: string;
          updated_at: string;
          user_id: string;
          wrapped_dek: string | null;
        };
        Insert: {
          created_at?: string;
          kdf_iterations?: number;
          key_check?: string | null;
          salt: string;
          updated_at?: string;
          user_id: string;
          wrapped_dek?: string | null;
        };
        Update: {
          created_at?: string;
          kdf_iterations?: number;
          key_check?: string | null;
          salt?: string;
          updated_at?: string;
          user_id?: string;
          wrapped_dek?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_savings_goal_deletion: {
        Args: { p_goal_id: string; p_mode: string; p_revision: Json };
        Returns: {
          budget_id: string;
        }[];
      };
      apply_savings_goal_generation_stop: {
        Args: {
          p_budget_line_ids: string[];
          p_goal_id: string;
          p_min_period_index: number;
          p_mode: string;
        };
        Returns: {
          budget_id: string;
          line_id: string;
        }[];
      };
      apply_savings_goal_plan: {
        Args: {
          p_goal_id: string;
          p_line_updates?: Json;
          p_min_period_index: number;
          p_plan_withdrawals?: Json;
        };
        Returns: {
          amount: string | null;
          budget_id: string;
          checked_at: string | null;
          created_at: string;
          exchange_rate: number | null;
          id: string;
          is_manually_adjusted: boolean;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          original_amount: string | null;
          original_currency: string | null;
          recurrence: Database['public']['Enums']['transaction_recurrence'];
          savings_goal_id: string | null;
          savings_withdrawal_group_id: string | null;
          source_savings_goal_id: string | null;
          source_savings_goal_name: string | null;
          spread_group_id: string | null;
          target_currency: string | null;
          template_line_id: string | null;
          updated_at: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'budget_line';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      apply_template_line_operations: {
        Args: {
          budget_ids?: string[];
          created_lines?: Json;
          delete_ids?: string[];
          template_id: string;
          updated_lines?: Json;
        };
        Returns: string[];
      };
      apply_template_line_operations_with_tags: {
        Args: {
          p_budget_ids?: string[];
          p_created_lines?: Json;
          p_delete_ids?: string[];
          p_line_tag_pairs?: Json;
          p_template_id: string;
          p_updated_lines?: Json;
        };
        Returns: string[];
      };
      assert_savings_goal_withdrawal_tags: {
        Args: { p_tag_ids: string[] };
        Returns: undefined;
      };
      bulk_replace_template_line_tags_and_sync: {
        Args: { p_budget_ids: string[]; p_line_tag_pairs: Json };
        Returns: undefined;
      };
      bulk_update_template_lines: {
        Args: { line_updates: Json; p_template_id: string };
        Returns: {
          amount: string;
          created_at: string;
          description: string;
          id: string;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          recurrence: Database['public']['Enums']['transaction_recurrence'];
          template_id: string;
          updated_at: string;
        }[];
      };
      bump_savings_goal_balance_revision: {
        Args: { p_goal_ids: string[] };
        Returns: undefined;
      };
      check_unchecked_transactions: {
        Args: { p_budget_line_id: string };
        Returns: {
          amount: string | null;
          budget_id: string;
          budget_line_id: string | null;
          checked_at: string | null;
          created_at: string;
          exchange_rate: number | null;
          id: string;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          original_amount: string | null;
          original_currency: string | null;
          source_savings_goal_id: string | null;
          source_savings_goal_name: string | null;
          target_currency: string | null;
          transaction_date: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'transaction';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      create_budget_from_template: {
        Args: {
          p_description: string;
          p_excluded_savings_goal_ids?: string[];
          p_month: number;
          p_template_id: string;
          p_user_id: string;
          p_year: number;
        };
        Returns: Json;
      };
      create_budget_lines_spread: {
        Args: {
          p_lines?: Json;
          p_source_budget_line_id?: string;
          p_source_transaction_id?: string;
          p_spread_group_id: string;
        };
        Returns: {
          amount: string | null;
          budget_id: string;
          checked_at: string | null;
          created_at: string;
          exchange_rate: number | null;
          id: string;
          is_manually_adjusted: boolean;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          original_amount: string | null;
          original_currency: string | null;
          recurrence: Database['public']['Enums']['transaction_recurrence'];
          savings_goal_id: string | null;
          savings_withdrawal_group_id: string | null;
          source_savings_goal_id: string | null;
          source_savings_goal_name: string | null;
          spread_group_id: string | null;
          target_currency: string | null;
          template_line_id: string | null;
          updated_at: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'budget_line';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      create_savings_goal_withdrawal: {
        Args: {
          p_expected_revision: number;
          p_goal_id: string;
          p_tag_ids?: string[];
          p_transaction: Json;
        };
        Returns: {
          amount: string | null;
          budget_id: string;
          budget_line_id: string | null;
          checked_at: string | null;
          created_at: string;
          exchange_rate: number | null;
          id: string;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          original_amount: string | null;
          original_currency: string | null;
          source_savings_goal_id: string | null;
          source_savings_goal_name: string | null;
          target_currency: string | null;
          transaction_date: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'transaction';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_template_with_lines: {
        Args: {
          p_description?: string;
          p_is_default?: boolean;
          p_lines?: Json;
          p_name: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      delete_savings_goal_withdrawal: {
        Args: { p_expected_revision: number; p_transaction_id: string };
        Returns: undefined;
      };
      get_savings_goal_deletion_impact: {
        Args: { p_goal_id: string };
        Returns: Json;
      };
      lock_savings_goal_for_withdrawal: {
        Args: { p_expected_revision: number; p_goal_id: string };
        Returns: string;
      };
      reconcile_savings_goal_target_date: {
        Args: {
          p_budget_line_ids: string[];
          p_expected_target_date: string;
          p_goal_id: string;
          p_mode: string;
          p_patch: Json;
        };
        Returns: Json;
      };
      rekey_user_encrypted_data: {
        Args: {
          p_budget_lines?: Json;
          p_key_check?: string;
          p_monthly_budgets?: Json;
          p_savings_goals?: Json;
          p_template_lines?: Json;
          p_transactions?: Json;
          p_user_id: string;
        };
        Returns: undefined;
      };
      rekey_user_encrypted_data_with_plan_withdrawals: {
        Args: {
          p_budget_lines?: Json;
          p_key_check?: string;
          p_monthly_budgets?: Json;
          p_plan_withdrawals?: Json;
          p_savings_goals?: Json;
          p_template_lines?: Json;
          p_transactions?: Json;
          p_user_id: string;
        };
        Returns: undefined;
      };
      replace_budget_line_tags: {
        Args: { p_budget_line_id: string; p_tag_ids: string[] };
        Returns: undefined;
      };
      replace_template_line_tags: {
        Args: { p_tag_ids: string[]; p_template_line_id: string };
        Returns: undefined;
      };
      replace_transaction_tags: {
        Args: { p_tag_ids: string[]; p_transaction_id: string };
        Returns: undefined;
      };
      toggle_budget_line_check: {
        Args: { p_budget_line_id: string };
        Returns: {
          amount: string | null;
          budget_id: string;
          checked_at: string | null;
          created_at: string;
          exchange_rate: number | null;
          id: string;
          is_manually_adjusted: boolean;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          original_amount: string | null;
          original_currency: string | null;
          recurrence: Database['public']['Enums']['transaction_recurrence'];
          savings_goal_id: string | null;
          savings_withdrawal_group_id: string | null;
          source_savings_goal_id: string | null;
          source_savings_goal_name: string | null;
          spread_group_id: string | null;
          target_currency: string | null;
          template_line_id: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'budget_line';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      toggle_transaction_check: {
        Args: { p_transaction_id: string };
        Returns: {
          amount: string | null;
          budget_id: string;
          budget_line_id: string | null;
          checked_at: string | null;
          created_at: string;
          exchange_rate: number | null;
          id: string;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          original_amount: string | null;
          original_currency: string | null;
          source_savings_goal_id: string | null;
          source_savings_goal_name: string | null;
          target_currency: string | null;
          transaction_date: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'transaction';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_budget_line_with_tags: {
        Args: { p_budget_line_id: string; p_patch: Json; p_tag_ids: string[] };
        Returns: {
          amount: string | null;
          budget_id: string;
          checked_at: string | null;
          created_at: string;
          exchange_rate: number | null;
          id: string;
          is_manually_adjusted: boolean;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          original_amount: string | null;
          original_currency: string | null;
          recurrence: Database['public']['Enums']['transaction_recurrence'];
          savings_goal_id: string | null;
          savings_withdrawal_group_id: string | null;
          source_savings_goal_id: string | null;
          source_savings_goal_name: string | null;
          spread_group_id: string | null;
          target_currency: string | null;
          template_line_id: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'budget_line';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_savings_goal_withdrawal: {
        Args: {
          p_expected_revision: number;
          p_patch: Json;
          p_tag_ids?: string[];
          p_transaction_id: string;
        };
        Returns: {
          amount: string | null;
          budget_id: string;
          budget_line_id: string | null;
          checked_at: string | null;
          created_at: string;
          exchange_rate: number | null;
          id: string;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          original_amount: string | null;
          original_currency: string | null;
          source_savings_goal_id: string | null;
          source_savings_goal_name: string | null;
          target_currency: string | null;
          transaction_date: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'transaction';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_template_line_with_tags: {
        Args: {
          p_patch: Json;
          p_tag_ids: string[];
          p_template_line_id: string;
        };
        Returns: {
          amount: string | null;
          created_at: string;
          description: string | null;
          exchange_rate: number | null;
          id: string;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          original_amount: string | null;
          original_currency: string | null;
          recurrence: Database['public']['Enums']['transaction_recurrence'];
          savings_goal_id: string | null;
          target_currency: string | null;
          template_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'template_line';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_transaction_with_tags: {
        Args: { p_patch: Json; p_tag_ids: string[]; p_transaction_id: string };
        Returns: {
          amount: string | null;
          budget_id: string;
          budget_line_id: string | null;
          checked_at: string | null;
          created_at: string;
          exchange_rate: number | null;
          id: string;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          original_amount: string | null;
          original_currency: string | null;
          source_savings_goal_id: string | null;
          source_savings_goal_name: string | null;
          target_currency: string | null;
          transaction_date: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'transaction';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      priority_level: 'HIGH' | 'MEDIUM' | 'LOW';
      savings_goal_status: 'ACTIVE' | 'COMPLETED' | 'PAUSED';
      transaction_kind: 'income' | 'expense' | 'saving';
      transaction_recurrence: 'fixed' | 'one_off';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      priority_level: ['HIGH', 'MEDIUM', 'LOW'],
      savings_goal_status: ['ACTIVE', 'COMPLETED', 'PAUSED'],
      transaction_kind: ['income', 'expense', 'saving'],
      transaction_recurrence: ['fixed', 'one_off'],
    },
  },
} as const;
