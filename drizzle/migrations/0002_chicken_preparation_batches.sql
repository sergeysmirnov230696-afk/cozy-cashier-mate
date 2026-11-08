CREATE TABLE public.chicken_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 employee_id uuid REFERENCES public.employees(id),
 employee_name text NOT NULL,
 raw_grams integer NOT NULL CHECK (raw_grams > 0),
 roasted_grams integer,
 meat_grams integer,
 roasted_by uuid REFERENCES public.employees(id),
 stripped_by uuid REFERENCES public.employees(id),
 started_at timestamptz NOT NULL DEFAULT now(),
 roasted_at timestamptz,
 stripped_at timestamptz,
 note text NOT NULL DEFAULT '',
 CONSTRAINT chicken_roast_weight CHECK (roasted_grams IS NULL OR (roasted_grams > 0 AND roasted_grams <= raw_grams)),
 CONSTRAINT chicken_meat_weight CHECK (meat_grams IS NULL OR (roasted_grams IS NOT NULL AND meat_grams > 0 AND meat_grams <= roasted_grams)),
 CONSTRAINT chicken_roast_stage CHECK ((roasted_grams IS NULL) = (roasted_at IS NULL)),
 CONSTRAINT chicken_strip_stage CHECK ((meat_grams IS NULL) = (stripped_at IS NULL))
);
GRANT ALL ON public.chicken_batches TO service_role;
ALTER TABLE public.chicken_batches ENABLE ROW LEVEL SECURITY;
CREATE INDEX chicken_batches_started_idx ON public.chicken_batches (started_at DESC);
COMMENT ON TABLE public.chicken_batches IS 'Cashier PIN-authenticated chicken preparation batches. All access through session-checked server functions; weights in integer grams. No shawarma sale deductions.';