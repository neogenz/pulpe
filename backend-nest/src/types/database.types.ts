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
      budget_templates: {
        Row: {
          category: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_default: boolean;
          name: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      budgets: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          month: number;
          template_id: string | null;
          updated_at: string;
          user_id: string | null;
          year: number;
        };
        Insert: {
          created_at?: string;
          description: string;
          id?: string;
          month: number;
          template_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
          year: number;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          month?: number;
          template_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'budgets_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'budget_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      template_transactions: {
        Row: {
          amount: number;
          created_at: string;
          description: string | null;
          expense_type: Database['public']['Enums']['expense_type'];
          id: string;
          is_recurring: boolean;
          name: string;
          template_id: string;
          type: Database['public']['Enums']['transaction_type'];
          updated_at: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          description?: string | null;
          expense_type: Database['public']['Enums']['expense_type'];
          id?: string;
          is_recurring?: boolean;
          name: string;
          template_id: string;
          type: Database['public']['Enums']['transaction_type'];
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          description?: string | null;
          expense_type?: Database['public']['Enums']['expense_type'];
          id?: string;
          is_recurring?: boolean;
          name?: string;
          template_id?: string;
          type?: Database['public']['Enums']['transaction_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'template_transactions_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'budget_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      transactions: {
        Row: {
          amount: number;
          budget_id: string;
          created_at: string;
          description: string | null;
          expense_type: Database['public']['Enums']['expense_type'];
          id: string;
          is_recurring: boolean;
          name: string;
          type: Database['public']['Enums']['transaction_type'];
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          amount: number;
          budget_id: string;
          created_at?: string;
          description?: string | null;
          expense_type: Database['public']['Enums']['expense_type'];
          id?: string;
          is_recurring?: boolean;
          name: string;
          type: Database['public']['Enums']['transaction_type'];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          amount?: number;
          budget_id?: string;
          created_at?: string;
          description?: string | null;
          expense_type?: Database['public']['Enums']['expense_type'];
          id?: string;
          is_recurring?: boolean;
          name?: string;
          type?: Database['public']['Enums']['transaction_type'];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'transactions_budget_id_fkey';
            columns: ['budget_id'];
            isOneToOne: false;
            referencedRelation: 'budgets';
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
    };
    Enums: {
      expense_type: 'fixed' | 'variable';
      transaction_type: 'expense' | 'income' | 'saving';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      expense_type: ['fixed', 'variable'],
      transaction_type: ['expense', 'income', 'saving'],
    },
  },
} as const;
