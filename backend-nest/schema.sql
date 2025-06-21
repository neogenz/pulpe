

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."expense_type" AS ENUM (
    'fixed',
    'variable'
);


ALTER TYPE "public"."expense_type" OWNER TO "postgres";


CREATE TYPE "public"."transaction_type" AS ENUM (
    'expense',
    'income',
    'saving'
);


ALTER TYPE "public"."transaction_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_confirm_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  new.email_confirmed_at = now();
  new.confirmed_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."auto_confirm_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_budget_from_onboarding_with_transactions"("p_user_id" "uuid", "p_month" integer, "p_year" integer, "p_description" "text", "p_monthly_income" numeric DEFAULT 0, "p_housing_costs" numeric DEFAULT 0, "p_health_insurance" numeric DEFAULT 0, "p_leasing_credit" numeric DEFAULT 0, "p_phone_plan" numeric DEFAULT 0, "p_transport_costs" numeric DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$DECLARE
  new_budget_id uuid;
  transaction_count integer := 0;
BEGIN
  -- Insert budget
  INSERT INTO public.budgets (user_id, month, year, description)
  VALUES (p_user_id, p_month, p_year, p_description)
  RETURNING id INTO new_budget_id;

  -- Insert income transaction if provided
  IF p_monthly_income > 0 THEN
    INSERT INTO public.transactions (
      user_id, budget_id, amount, type, expense_type, name, description, is_recurring
    ) VALUES (
      p_user_id, new_budget_id, p_monthly_income, 'income', 'fixed', 'Revenu mensuel', NULL, true
    );
    transaction_count := transaction_count + 1;
  END IF;

  -- Insert housing costs transaction if provided
  IF p_housing_costs > 0 THEN
    INSERT INTO public.transactions (
      user_id, budget_id, amount, type, expense_type, name, description, is_recurring
    ) VALUES (
      p_user_id, new_budget_id, p_housing_costs, 'expense', 'fixed', 'Loyer', NULL, true
    );
    transaction_count := transaction_count + 1;
  END IF;

  -- Insert health insurance transaction if provided
  IF p_health_insurance > 0 THEN
    INSERT INTO public.transactions (
      user_id, budget_id, amount, type, expense_type, name, description, is_recurring
    ) VALUES (
      p_user_id, new_budget_id, p_health_insurance, 'expense', 'fixed', 'Assurance santé', NULL, true
    );
    transaction_count := transaction_count + 1;
  END IF;

  -- Insert leasing credit transaction if provided
  IF p_leasing_credit > 0 THEN
    INSERT INTO public.transactions (
      user_id, budget_id, amount, type, expense_type, name, description, is_recurring
    ) VALUES (
      p_user_id, new_budget_id, p_leasing_credit, 'expense', 'fixed', 'Crédit leasing', NULL, true
    );
    transaction_count := transaction_count + 1;
  END IF;

  -- Insert phone plan transaction if provided
  IF p_phone_plan > 0 THEN
    INSERT INTO public.transactions (
      user_id, budget_id, amount, type, expense_type, name, description, is_recurring
    ) VALUES (
      p_user_id, new_budget_id, p_phone_plan, 'expense', 'fixed', 'Forfait téléphonique', NULL, true
    );
    transaction_count := transaction_count + 1;
  END IF;

  -- Insert transport costs transaction if provided
  IF p_transport_costs > 0 THEN
    INSERT INTO public.transactions (
      user_id, budget_id, amount, type, expense_type, name, description, is_recurring
    ) VALUES (
      p_user_id, new_budget_id, p_transport_costs, 'expense', 'fixed', 'Frais de transport', NULL, true
    );
    transaction_count := transaction_count + 1;
  END IF;

  -- Return budget data with transaction count (matches service expectations)
  RETURN jsonb_build_object(
    'budget', (
      SELECT to_jsonb(b.*) 
      FROM public.budgets b 
      WHERE b.id = new_budget_id
    ),
    'transactions_created', transaction_count
  );
END;$$;


ALTER FUNCTION "public"."create_budget_from_onboarding_with_transactions"("p_user_id" "uuid", "p_month" integer, "p_year" integer, "p_description" "text", "p_monthly_income" numeric, "p_housing_costs" numeric, "p_health_insurance" numeric, "p_leasing_credit" numeric, "p_phone_plan" numeric, "p_transport_costs" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "month" integer NOT NULL,
    "year" integer NOT NULL,
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    CONSTRAINT "budgets_month_check" CHECK ((("month" >= 1) AND ("month" <= 12))),
    CONSTRAINT "budgets_year_check" CHECK (("year" >= 1900))
);


ALTER TABLE "public"."budgets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "budget_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "type" "public"."transaction_type" NOT NULL,
    "expense_type" "public"."expense_type" NOT NULL,
    "description" "text",
    "is_recurring" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    CONSTRAINT "transactions_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "unique_month_year_per_user" UNIQUE ("month", "year", "user_id");



CREATE INDEX "budgets_user_id_idx" ON "public"."budgets" USING "btree" ("user_id");



CREATE INDEX "idx_budgets_created_at" ON "public"."budgets" USING "btree" ("created_at");



CREATE INDEX "idx_budgets_month_year" ON "public"."budgets" USING "btree" ("year", "month");



CREATE INDEX "idx_transactions_budget_id" ON "public"."transactions" USING "btree" ("budget_id");



CREATE INDEX "idx_transactions_created_at" ON "public"."transactions" USING "btree" ("created_at");



CREATE INDEX "idx_transactions_expense_type" ON "public"."transactions" USING "btree" ("expense_type");



CREATE INDEX "idx_transactions_is_recurring" ON "public"."transactions" USING "btree" ("is_recurring");



CREATE INDEX "idx_transactions_type" ON "public"."transactions" USING "btree" ("type");



CREATE INDEX "transactions_user_id_idx" ON "public"."transactions" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "update_budgets_updated_at" BEFORE UPDATE ON "public"."budgets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_transactions_updated_at" BEFORE UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Utilisateurs peuvent créer leurs budgets" ON "public"."budgets" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Utilisateurs peuvent créer leurs transactions" ON "public"."transactions" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Utilisateurs peuvent modifier leurs budgets" ON "public"."budgets" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Utilisateurs peuvent modifier leurs transactions" ON "public"."transactions" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Utilisateurs peuvent supprimer leurs budgets" ON "public"."budgets" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Utilisateurs peuvent supprimer leurs transactions" ON "public"."transactions" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Utilisateurs peuvent voir leurs budgets" ON "public"."budgets" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Utilisateurs peuvent voir leurs transactions" ON "public"."transactions" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."budgets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_confirm_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_confirm_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_confirm_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_budget_from_onboarding_with_transactions"("p_user_id" "uuid", "p_month" integer, "p_year" integer, "p_description" "text", "p_monthly_income" numeric, "p_housing_costs" numeric, "p_health_insurance" numeric, "p_leasing_credit" numeric, "p_phone_plan" numeric, "p_transport_costs" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."create_budget_from_onboarding_with_transactions"("p_user_id" "uuid", "p_month" integer, "p_year" integer, "p_description" "text", "p_monthly_income" numeric, "p_housing_costs" numeric, "p_health_insurance" numeric, "p_leasing_credit" numeric, "p_phone_plan" numeric, "p_transport_costs" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_budget_from_onboarding_with_transactions"("p_user_id" "uuid", "p_month" integer, "p_year" integer, "p_description" "text", "p_monthly_income" numeric, "p_housing_costs" numeric, "p_health_insurance" numeric, "p_leasing_credit" numeric, "p_phone_plan" numeric, "p_transport_costs" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."budgets" TO "anon";
GRANT ALL ON TABLE "public"."budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."budgets" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






RESET ALL;
