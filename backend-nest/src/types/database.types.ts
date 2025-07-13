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
          created_at: string;
          description: string | null;
          expense_type: Database['public']['Enums']['transaction_recurrence'];
          id: string;
          is_recurring: boolean;
          name: string;
          type: Database['public']['Enums']['transaction_kind'];
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          amount: number;
          budget_id: string;
          created_at?: string;
          description?: string | null;
          expense_type: Database['public']['Enums']['transaction_recurrence'];
          id?: string;
          is_recurring?: boolean;
          name: string;
          type: Database['public']['Enums']['transaction_kind'];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          amount?: number;
          budget_id?: string;
          created_at?: string;
          description?: string | null;
          expense_type?: Database['public']['Enums']['transaction_recurrence'];
          id?: string;
          is_recurring?: boolean;
          name?: string;
          type?: Database['public']['Enums']['transaction_kind'];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'transactions_budget_id_fkey';
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
      create_budget_from_onboarding_with_transactions: {
        Args:
          | {
              p_month: number;
              p_year: number;
              p_description: string;
              p_monthly_income?: number;
              p_housing_costs?: number;
              p_health_insurance?: number;
              p_leasing_credit?: number;
              p_phone_plan?: number;
              p_transport_costs?: number;
            }
          | {
              p_user_id: string;
              p_month: number;
              p_year: number;
              p_description: string;
              p_monthly_income?: number;
              p_housing_costs?: number;
              p_health_insurance?: number;
              p_leasing_credit?: number;
              p_phone_plan?: number;
              p_transport_costs?: number;
            };
        Returns: Json;
      };
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
      transaction_kind: 'expense' | 'income' | 'saving' | 'exceptional_income';
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
      transaction_kind: ['expense', 'income', 'saving', 'exceptional_income'],
      transaction_recurrence: ['fixed', 'variable', 'one_off'],
    },
  },
} as const;
