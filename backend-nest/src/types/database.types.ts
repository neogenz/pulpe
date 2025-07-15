export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '12.2.3 (519615d)';
  };
  public: {
    Tables: {
      budget_line: {
        Row: {
          amount: number;
          budget_id: string;
          created_at: string;
          id: string;
          is_manually_adjusted: boolean;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          recurrence: Database['public']['Enums']['transaction_recurrence'];
          savings_goal_id: string | null;
          template_line_id: string | null;
          updated_at: string;
        };
        Insert: {
          amount: number;
          budget_id: string;
          created_at?: string;
          id?: string;
          is_manually_adjusted?: boolean;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          recurrence: Database['public']['Enums']['transaction_recurrence'];
          savings_goal_id?: string | null;
          template_line_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          budget_id?: string;
          created_at?: string;
          id?: string;
          is_manually_adjusted?: boolean;
          kind?: Database['public']['Enums']['transaction_kind'];
          name?: string;
          recurrence?: Database['public']['Enums']['transaction_recurrence'];
          savings_goal_id?: string | null;
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
            foreignKeyName: 'budget_line_template_line_id_fkey';
            columns: ['template_line_id'];
            isOneToOne: false;
            referencedRelation: 'template_line';
            referencedColumns: ['id'];
          },
        ];
      };
      monthly_budget: {
        Row: {
          created_at: string;
          description: string;
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
          created_at: string;
          id: string;
          name: string;
          priority: Database['public']['Enums']['priority_level'];
          status: Database['public']['Enums']['savings_goal_status'];
          target_amount: number;
          target_date: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          priority: Database['public']['Enums']['priority_level'];
          status?: Database['public']['Enums']['savings_goal_status'];
          target_amount: number;
          target_date: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          priority?: Database['public']['Enums']['priority_level'];
          status?: Database['public']['Enums']['savings_goal_status'];
          target_amount?: number;
          target_date?: string;
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
          amount: number;
          created_at: string;
          description: string | null;
          id: string;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          recurrence: Database['public']['Enums']['transaction_recurrence'];
          template_id: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          recurrence: Database['public']['Enums']['transaction_recurrence'];
          template_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          kind?: Database['public']['Enums']['transaction_kind'];
          name?: string;
          recurrence?: Database['public']['Enums']['transaction_recurrence'];
          template_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'template_transactions_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'template';
            referencedColumns: ['id'];
          },
        ];
      };
      transaction: {
        Row: {
          amount: number;
          budget_id: string;
          category: string | null;
          created_at: string;
          id: string;
          is_out_of_budget: boolean;
          kind: Database['public']['Enums']['transaction_kind'];
          name: string;
          transaction_date: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          budget_id: string;
          category?: string | null;
          created_at?: string;
          id?: string;
          is_out_of_budget?: boolean;
          kind?: Database['public']['Enums']['transaction_kind'];
          name: string;
          transaction_date?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          budget_id?: string;
          category?: string | null;
          created_at?: string;
          id?: string;
          is_out_of_budget?: boolean;
          kind?: Database['public']['Enums']['transaction_kind'];
          name?: string;
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
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_budget_from_template: {
        Args: {
          p_user_id: string;
          p_template_id: string;
          p_month: number;
          p_year: number;
          p_description: string;
        };
        Returns: Json;
      };
      create_template_with_lines: {
        Args: {
          p_user_id: string;
          p_name: string;
          p_description?: string;
          p_is_default?: boolean;
          p_lines?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      priority_level: 'HIGH' | 'MEDIUM' | 'LOW';
      savings_goal_status: 'ACTIVE' | 'COMPLETED' | 'PAUSED';
      transaction_kind: 'INCOME' | 'FIXED_EXPENSE' | 'SAVINGS_CONTRIBUTION';
      transaction_recurrence: 'fixed' | 'variable' | 'one_off';
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
  public: {
    Enums: {
      priority_level: ['HIGH', 'MEDIUM', 'LOW'],
      savings_goal_status: ['ACTIVE', 'COMPLETED', 'PAUSED'],
      transaction_kind: ['INCOME', 'FIXED_EXPENSE', 'SAVINGS_CONTRIBUTION'],
      transaction_recurrence: ['fixed', 'variable', 'one_off'],
    },
  },
} as const;
