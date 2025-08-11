

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



CREATE TYPE "public"."priority_level" AS ENUM (
    'HIGH',
    'MEDIUM',
    'LOW'
);


ALTER TYPE "public"."priority_level" OWNER TO "postgres";


CREATE TYPE "public"."savings_goal_status" AS ENUM (
    'ACTIVE',
    'COMPLETED',
    'PAUSED'
);


ALTER TYPE "public"."savings_goal_status" OWNER TO "postgres";


CREATE TYPE "public"."transaction_kind" AS ENUM (
    'income',
    'expense',
    'saving'
);


ALTER TYPE "public"."transaction_kind" OWNER TO "postgres";


CREATE TYPE "public"."transaction_recurrence" AS ENUM (
    'fixed',
    'variable',
    'one_off'
);


ALTER TYPE "public"."transaction_recurrence" OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."bulk_update_template_lines"("p_template_id" "uuid", "line_updates" "jsonb") RETURNS TABLE("id" "uuid", "template_id" "uuid", "name" "text", "amount" numeric, "kind" "public"."transaction_kind", "recurrence" "public"."transaction_recurrence", "description" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  line_update JSONB;
  updated_count INTEGER := 0;
BEGIN
  -- Validate that template exists and belongs to authenticated user
  IF NOT EXISTS(
    SELECT 1 FROM public.template t 
    WHERE t.id = p_template_id 
    AND t.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Template not found or access denied'
      USING ERRCODE = 'P0001';
  END IF;

  -- Process each line update atomically
  FOR line_update IN SELECT * FROM jsonb_array_elements(line_updates)
  LOOP
    -- Validate that the line exists and belongs to the template
    IF NOT EXISTS(
      SELECT 1 FROM public.template_line tl 
      WHERE tl.id = (line_update->>'id')::UUID 
      AND tl.template_id = p_template_id
    ) THEN
      RAISE EXCEPTION 'Template line % not found or does not belong to template %', 
        line_update->>'id', p_template_id
        USING ERRCODE = 'P0002';
    END IF;

    -- Update the template line with proper type casting
    -- Use CASE statements to avoid COALESCE type mismatch issues
    UPDATE public.template_line 
    SET 
      name = CASE 
        WHEN line_update->>'name' IS NOT NULL THEN (line_update->>'name')::TEXT
        ELSE public.template_line.name
      END,
      amount = CASE 
        WHEN line_update->>'amount' IS NOT NULL THEN (line_update->>'amount')::NUMERIC
        ELSE public.template_line.amount
      END,
      kind = CASE 
        WHEN line_update->>'kind' IS NOT NULL THEN (line_update->>'kind')::public.transaction_kind
        ELSE public.template_line.kind
      END,
      recurrence = CASE 
        WHEN line_update->>'recurrence' IS NOT NULL THEN (line_update->>'recurrence')::public.transaction_recurrence
        ELSE public.template_line.recurrence
      END,
      description = CASE 
        WHEN line_update->>'description' IS NOT NULL THEN (line_update->>'description')::TEXT
        ELSE public.template_line.description
      END,
      updated_at = NOW()
    WHERE 
      public.template_line.id = (line_update->>'id')::UUID 
      AND public.template_line.template_id = p_template_id;
    
    updated_count := updated_count + 1;
  END LOOP;

  -- Return all updated template lines
  RETURN QUERY
  SELECT 
    tl.id,
    tl.template_id,
    tl.name,
    tl.amount,
    tl.kind,
    tl.recurrence,
    COALESCE(tl.description, '') as description,
    tl.created_at,
    tl.updated_at
  FROM public.template_line tl
  WHERE tl.template_id = p_template_id
  ORDER BY tl.created_at;
END;
$$;


ALTER FUNCTION "public"."bulk_update_template_lines"("p_template_id" "uuid", "line_updates" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_budget_from_template"("p_user_id" "uuid", "p_template_id" "uuid", "p_month" integer, "p_year" integer, "p_description" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  new_budget_id uuid;
  template_record record;
  template_line_record record;
  budget_line_count integer := 0;
BEGIN
  -- Validate template exists and user has access
  SELECT id, user_id, name INTO template_record
  FROM public.template 
  WHERE id = p_template_id 
    AND (user_id = p_user_id OR user_id IS NULL);
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found or access denied';
  END IF;

  -- Check if budget already exists for this period
  IF EXISTS (
    SELECT 1 FROM public.monthly_budget 
    WHERE user_id = p_user_id 
      AND month = p_month 
      AND year = p_year
  ) THEN
    RAISE EXCEPTION 'Budget already exists for this period';
  END IF;

  -- Create the budget
  INSERT INTO public.monthly_budget (user_id, template_id, month, year, description)
  VALUES (p_user_id, p_template_id, p_month, p_year, p_description)
  RETURNING id INTO new_budget_id;

  -- Copy all template lines to budget lines using correct columns
  FOR template_line_record IN
    SELECT tl.id, tl.amount, tl.kind, tl.recurrence, tl.name, tl.description
    FROM public.template_line tl
    WHERE tl.template_id = p_template_id
    ORDER BY tl.created_at
  LOOP
    INSERT INTO public.budget_line (
      budget_id, template_line_id, amount, kind, recurrence, name
    ) VALUES (
      new_budget_id, 
      template_line_record.id,
      template_line_record.amount, 
      template_line_record.kind,
      template_line_record.recurrence,
      template_line_record.name
    );
    
    budget_line_count := budget_line_count + 1;
  END LOOP;

  -- Return budget data with budget line count
  RETURN jsonb_build_object(
    'budget', (
      SELECT to_jsonb(b.*) 
      FROM public.monthly_budget b 
      WHERE b.id = new_budget_id
    ),
    'budget_lines_created', budget_line_count,
    'template_name', template_record.name
  );
END;
$$;


ALTER FUNCTION "public"."create_budget_from_template"("p_user_id" "uuid", "p_template_id" "uuid", "p_month" integer, "p_year" integer, "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_template_with_lines"("p_user_id" "uuid", "p_name" "text", "p_description" "text" DEFAULT NULL::"text", "p_is_default" boolean DEFAULT false, "p_lines" "jsonb" DEFAULT NULL::"jsonb") RETURNS "json"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  new_template_id uuid;
  line_record jsonb;
  result json;
BEGIN
  -- Create the template
  INSERT INTO public.template (user_id, name, description, is_default)
  VALUES (p_user_id, p_name, p_description, p_is_default)
  RETURNING id INTO new_template_id;

  -- Create template lines if provided
  IF p_lines IS NOT NULL THEN
    FOR line_record IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
      INSERT INTO public.template_line (
        template_id, 
        name, 
        amount, 
        kind, 
        recurrence, 
        description
      ) VALUES (
        new_template_id,
        line_record->>'name',
        (line_record->>'amount')::numeric,
        (line_record->>'kind')::public.transaction_kind,
        (line_record->>'recurrence')::public.transaction_recurrence,
        line_record->>'description'
      );
    END LOOP;
  END IF;

  -- Return the created template
  SELECT json_build_object(
    'id', t.id,
    'user_id', t.user_id,
    'name', t.name,
    'description', t.description,
    'is_default', t.is_default,
    'created_at', t.created_at,
    'updated_at', t.updated_at
  ) INTO result
  FROM public.template t
  WHERE t.id = new_template_id;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."create_template_with_lines"("p_user_id" "uuid", "p_name" "text", "p_description" "text", "p_is_default" boolean, "p_lines" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."budget_line" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "budget_id" "uuid" NOT NULL,
    "template_line_id" "uuid",
    "savings_goal_id" "uuid",
    "name" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "recurrence" "public"."transaction_recurrence" NOT NULL,
    "is_manually_adjusted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "kind" "public"."transaction_kind" NOT NULL,
    CONSTRAINT "budget_line_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."budget_line" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."monthly_budget" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "month" integer NOT NULL,
    "year" integer NOT NULL,
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "template_id" "uuid" NOT NULL,
    CONSTRAINT "budgets_month_check" CHECK ((("month" >= 1) AND ("month" <= 12))),
    CONSTRAINT "budgets_year_check" CHECK (("year" >= 1900))
);


ALTER TABLE "public"."monthly_budget" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."savings_goal" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "target_amount" numeric(12,2) NOT NULL,
    "target_date" "date" NOT NULL,
    "priority" "public"."priority_level" NOT NULL,
    "status" "public"."savings_goal_status" DEFAULT 'ACTIVE'::"public"."savings_goal_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "savings_goal_target_amount_check" CHECK (("target_amount" > (0)::numeric))
);


ALTER TABLE "public"."savings_goal" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."template" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."template" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."template_line" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "recurrence" "public"."transaction_recurrence" NOT NULL,
    "kind" "public"."transaction_kind" NOT NULL,
    CONSTRAINT "template_transactions_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."template_line" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "budget_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "transaction_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_out_of_budget" boolean DEFAULT false NOT NULL,
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "kind" "public"."transaction_kind" NOT NULL,
    CONSTRAINT "transaction_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."transaction" OWNER TO "postgres";


ALTER TABLE ONLY "public"."budget_line"
    ADD CONSTRAINT "budget_line_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template"
    ADD CONSTRAINT "budget_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monthly_budget"
    ADD CONSTRAINT "budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."savings_goal"
    ADD CONSTRAINT "savings_goal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_line"
    ADD CONSTRAINT "template_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction"
    ADD CONSTRAINT "transaction_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monthly_budget"
    ADD CONSTRAINT "unique_month_year_per_user" UNIQUE ("month", "year", "user_id");



CREATE INDEX "budgets_user_id_idx" ON "public"."monthly_budget" USING "btree" ("user_id");



CREATE INDEX "idx_budget_line_budget_id" ON "public"."budget_line" USING "btree" ("budget_id");



CREATE INDEX "idx_budget_line_savings_goal_id" ON "public"."budget_line" USING "btree" ("savings_goal_id");



CREATE INDEX "idx_budget_line_template_line_id" ON "public"."budget_line" USING "btree" ("template_line_id");



CREATE INDEX "idx_budget_templates_user_id" ON "public"."template" USING "btree" ("user_id");



CREATE INDEX "idx_budgets_created_at" ON "public"."monthly_budget" USING "btree" ("created_at");



CREATE INDEX "idx_budgets_month_year" ON "public"."monthly_budget" USING "btree" ("year", "month");



CREATE INDEX "idx_budgets_template_id" ON "public"."monthly_budget" USING "btree" ("template_id");



CREATE INDEX "idx_savings_goal_status" ON "public"."savings_goal" USING "btree" ("status");



CREATE INDEX "idx_savings_goal_user_id" ON "public"."savings_goal" USING "btree" ("user_id");



CREATE INDEX "idx_template_transactions_template_id" ON "public"."template_line" USING "btree" ("template_id");



CREATE INDEX "idx_transaction_budget_id" ON "public"."transaction" USING "btree" ("budget_id");



CREATE INDEX "idx_transaction_date" ON "public"."transaction" USING "btree" ("transaction_date");



CREATE OR REPLACE TRIGGER "update_budget_line_updated_at" BEFORE UPDATE ON "public"."budget_line" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_budget_templates_updated_at" BEFORE UPDATE ON "public"."template" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_budgets_updated_at" BEFORE UPDATE ON "public"."monthly_budget" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_savings_goal_updated_at" BEFORE UPDATE ON "public"."savings_goal" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_template_transactions_updated_at" BEFORE UPDATE ON "public"."template_line" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_transaction_updated_at" BEFORE UPDATE ON "public"."transaction" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."budget_line"
    ADD CONSTRAINT "budget_line_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "public"."monthly_budget"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budget_line"
    ADD CONSTRAINT "budget_line_savings_goal_id_fkey" FOREIGN KEY ("savings_goal_id") REFERENCES "public"."savings_goal"("id");



ALTER TABLE ONLY "public"."budget_line"
    ADD CONSTRAINT "budget_line_template_line_id_fkey" FOREIGN KEY ("template_line_id") REFERENCES "public"."template_line"("id");



ALTER TABLE ONLY "public"."template"
    ADD CONSTRAINT "budget_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."monthly_budget"
    ADD CONSTRAINT "budgets_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id");



ALTER TABLE ONLY "public"."monthly_budget"
    ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."savings_goal"
    ADD CONSTRAINT "savings_goal_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_line"
    ADD CONSTRAINT "template_transactions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction"
    ADD CONSTRAINT "transaction_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "public"."monthly_budget"("id") ON DELETE CASCADE;



CREATE POLICY "Users can create own budget lines" ON "public"."budget_line" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."monthly_budget" "mb"
  WHERE (("mb"."id" = "budget_line"."budget_id") AND ("mb"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can create own savings goals" ON "public"."savings_goal" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can create own templates" ON "public"."template" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can create own transactions" ON "public"."transaction" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."monthly_budget" "mb"
  WHERE (("mb"."id" = "transaction"."budget_id") AND ("mb"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can delete own budget lines" ON "public"."budget_line" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."monthly_budget" "mb"
  WHERE (("mb"."id" = "budget_line"."budget_id") AND ("mb"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can delete own savings goals" ON "public"."savings_goal" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can delete own templates" ON "public"."template" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can delete own transactions" ON "public"."transaction" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."monthly_budget" "mb"
  WHERE (("mb"."id" = "transaction"."budget_id") AND ("mb"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can delete template transactions for own templates" ON "public"."template_line" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."template" "bt"
  WHERE (("bt"."id" = "template_line"."template_id") AND ("bt"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can insert template transactions for own templates" ON "public"."template_line" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."template" "bt"
  WHERE (("bt"."id" = "template_line"."template_id") AND ("bt"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can update own budget lines" ON "public"."budget_line" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."monthly_budget" "mb"
  WHERE (("mb"."id" = "budget_line"."budget_id") AND ("mb"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can update own savings goals" ON "public"."savings_goal" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update own templates" ON "public"."template" FOR UPDATE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update own transactions" ON "public"."transaction" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."monthly_budget" "mb"
  WHERE (("mb"."id" = "transaction"."budget_id") AND ("mb"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can update template transactions for own templates" ON "public"."template_line" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."template" "bt"
  WHERE (("bt"."id" = "template_line"."template_id") AND ("bt"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."template" "bt"
  WHERE (("bt"."id" = "template_line"."template_id") AND ("bt"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view own budget lines" ON "public"."budget_line" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."monthly_budget" "mb"
  WHERE (("mb"."id" = "budget_line"."budget_id") AND ("mb"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view own savings goals" ON "public"."savings_goal" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view own templates" ON "public"."template" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can view own transactions" ON "public"."transaction" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."monthly_budget" "mb"
  WHERE (("mb"."id" = "transaction"."budget_id") AND ("mb"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view template transactions based on template access" ON "public"."template_line" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."template" "bt"
  WHERE (("bt"."id" = "template_line"."template_id") AND (("bt"."user_id" IS NULL) OR ("bt"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Utilisateurs peuvent créer leurs budgets" ON "public"."monthly_budget" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Utilisateurs peuvent modifier leurs budgets" ON "public"."monthly_budget" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Utilisateurs peuvent supprimer leurs budgets" ON "public"."monthly_budget" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Utilisateurs peuvent voir leurs budgets" ON "public"."monthly_budget" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."budget_line" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."monthly_budget" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."savings_goal" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."template" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."template_line" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transaction" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_confirm_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_confirm_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_confirm_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_update_template_lines"("p_template_id" "uuid", "line_updates" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_update_template_lines"("p_template_id" "uuid", "line_updates" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_update_template_lines"("p_template_id" "uuid", "line_updates" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_budget_from_template"("p_user_id" "uuid", "p_template_id" "uuid", "p_month" integer, "p_year" integer, "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_budget_from_template"("p_user_id" "uuid", "p_template_id" "uuid", "p_month" integer, "p_year" integer, "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_budget_from_template"("p_user_id" "uuid", "p_template_id" "uuid", "p_month" integer, "p_year" integer, "p_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_template_with_lines"("p_user_id" "uuid", "p_name" "text", "p_description" "text", "p_is_default" boolean, "p_lines" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_template_with_lines"("p_user_id" "uuid", "p_name" "text", "p_description" "text", "p_is_default" boolean, "p_lines" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_template_with_lines"("p_user_id" "uuid", "p_name" "text", "p_description" "text", "p_is_default" boolean, "p_lines" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."budget_line" TO "anon";
GRANT ALL ON TABLE "public"."budget_line" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_line" TO "service_role";



GRANT ALL ON TABLE "public"."monthly_budget" TO "anon";
GRANT ALL ON TABLE "public"."monthly_budget" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_budget" TO "service_role";



GRANT ALL ON TABLE "public"."savings_goal" TO "anon";
GRANT ALL ON TABLE "public"."savings_goal" TO "authenticated";
GRANT ALL ON TABLE "public"."savings_goal" TO "service_role";



GRANT ALL ON TABLE "public"."template" TO "anon";
GRANT ALL ON TABLE "public"."template" TO "authenticated";
GRANT ALL ON TABLE "public"."template" TO "service_role";



GRANT ALL ON TABLE "public"."template_line" TO "anon";
GRANT ALL ON TABLE "public"."template_line" TO "authenticated";
GRANT ALL ON TABLE "public"."template_line" TO "service_role";



GRANT ALL ON TABLE "public"."transaction" TO "anon";
GRANT ALL ON TABLE "public"."transaction" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction" TO "service_role";



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
