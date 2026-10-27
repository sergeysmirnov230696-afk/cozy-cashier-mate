ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_order_id uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_receipt jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS orders_client_order_id_unique ON public.orders(client_order_id) WHERE client_order_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.commit_cashier_sale(p_key uuid, p_order jsonb, p_items jsonb, p_stock jsonb, p_customer jsonb, p_receipt jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders; receipt jsonb; c public.customers; sh public.shifts;
BEGIN
 IF p_key IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text,0));
  SELECT * INTO o FROM public.orders WHERE client_order_id=p_key;
  IF FOUND THEN
   IF o.employee_id IS DISTINCT FROM (p_order->>'employee_id')::uuid THEN RAISE EXCEPTION 'Заказ другого кассира'; END IF;
   RETURN jsonb_build_object('replay',true,'receipt',o.client_receipt);
  END IF;
 END IF;
 SELECT * INTO sh FROM public.shifts WHERE id=(p_order->>'shift_id')::uuid FOR UPDATE;
 IF NOT FOUND OR sh.status <> 'open' OR sh.opened_at + interval '24 hours' <= now() THEN RAISE EXCEPTION 'Смена закрыта. Заказ сохранён на кассе'; END IF;
 PERFORM pg_advisory_xact_lock(901724);
 INSERT INTO public.orders(client_order_id,shift_id,employee_id,subtotal,discount,total,payment_method,cash_amount,card_amount,cash_received,change_given,status,order_type,customer_name,customer_phone,customer_id,bonus_earned,bonus_used,note,created_at)
 VALUES(p_key,sh.id,(p_order->>'employee_id')::uuid,(p_order->>'subtotal')::integer,(p_order->>'discount')::integer,(p_order->>'total')::integer,p_order->>'payment_method',(p_order->>'cash_amount')::integer,(p_order->>'card_amount')::integer,(p_order->>'cash_received')::integer,(p_order->>'change_given')::integer,'open',p_order->>'order_type',p_order->>'customer_name',p_order->>'customer_phone',(p_order->>'customer_id')::uuid,(p_order->>'bonus_earned')::integer,(p_order->>'bonus_used')::integer,p_order->>'note',coalesce((p_order->>'created_at')::timestamptz,now())) RETURNING * INTO o;
 INSERT INTO public.order_items(order_id,product_id,name,price,qty,modifiers,total)
 SELECT o.id,(x->>'product_id')::uuid,x->>'name',(x->>'price')::integer,(x->>'qty')::numeric,x->'modifiers',(x->>'total')::integer FROM jsonb_array_elements(p_items) x;
 INSERT INTO public.stock_movements(product_id,qty,type,note)
 SELECT (x->>'product_id')::uuid,(x->>'qty')::numeric,'sale','Заказ №' || o.daily_no FROM jsonb_array_elements(p_stock) x;
 IF o.customer_id IS NOT NULL THEN
  SELECT * INTO c FROM public.customers WHERE id=o.customer_id FOR UPDATE;
  IF c.bonus < o.bonus_used THEN RAISE EXCEPTION 'Недостаточно бонусов'; END IF;
  UPDATE public.customers SET bonus=bonus-o.bonus_used+o.bonus_earned,visits=visits+1,total_spent=total_spent+o.total,name=coalesce(p_customer->>'name',name) WHERE id=o.customer_id;
 ELSIF length(coalesce(o.customer_phone,''))>=5 THEN
  INSERT INTO public.customers(phone,name,visits,total_spent,bonus) VALUES(o.customer_phone,coalesce(p_customer->>'name',''),1,o.total,o.bonus_earned)
  ON CONFLICT(phone) DO UPDATE SET visits=customers.visits+1,total_spent=customers.total_spent+o.total,bonus=customers.bonus+o.bonus_earned;
 END IF;
 receipt := p_receipt || jsonb_build_object('orderId',o.id,'orderNo',o.order_no,'dailyNo',o.daily_no,'createdAt',o.created_at);
 UPDATE public.orders SET client_receipt=receipt WHERE id=o.id;
 INSERT INTO public.audit_log(employee_id,employee_name,action,entity,entity_id,details) VALUES(o.employee_id,p_receipt->>'cashierName','order_created','order',o.id,jsonb_build_object('daily_no',o.daily_no,'total',o.total,'client_order_id',p_key));
 RETURN jsonb_build_object('replay',false,'receipt',receipt);
END;
$$;
REVOKE ALL ON FUNCTION public.commit_cashier_sale(uuid,jsonb,jsonb,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_cashier_sale(uuid,jsonb,jsonb,jsonb,jsonb,jsonb) TO service_role;