CREATE OR REPLACE FUNCTION public.correct_order_payment(p_order_id uuid, p_method text, p_card integer, p_received integer, p_expected jsonb) RETURNS public.orders LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE o public.orders; updated public.orders; v_card integer; v_cash integer; v_received integer; v_sales bigint; v_count integer; v_cash_total bigint; v_ops bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN RAISE EXCEPTION 'Недостаточно прав для исправления оплаты'; END IF;
 SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Чек не найден'; END IF;
 IF o.status NOT IN ('open','completed','paid') THEN RAISE EXCEPTION 'Нельзя изменить оплату отменённого чека или возврата'; END IF;
 IF o.fiscal_status NOT IN ('none','error') OR o.fiscal_number IS NOT NULL OR o.kaspi_txn_id IS NOT NULL THEN RAISE EXCEPTION 'Фискальный или Kaspi-чек требует отдельной коррекции у оператора'; END IF;
 IF jsonb_build_object('payment_method',o.payment_method,'cash_amount',o.cash_amount,'card_amount',o.card_amount,'cash_received',o.cash_received,'change_given',o.change_given) IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Оплата уже изменена. Обновите чек и повторите'; END IF;
 IF p_method IS NULL OR p_method NOT IN ('cash','card','mixed') THEN RAISE EXCEPTION 'Неизвестный способ оплаты'; END IF;
 v_card := CASE WHEN p_method='card' THEN o.total WHEN p_method='cash' THEN 0 ELSE p_card END;
 IF v_card IS NULL OR v_card < 0 OR v_card > o.total THEN RAISE EXCEPTION 'Некорректная сумма по карте'; END IF;
 v_cash := o.total-v_card;
 v_received := CASE WHEN p_method='card' THEN 0 ELSE p_received END;
 IF v_received IS NULL OR v_received < v_cash THEN RAISE EXCEPTION 'Наличных меньше суммы к оплате'; END IF;
 IF o.shift_id IS NOT NULL THEN PERFORM 1 FROM public.shifts WHERE id=o.shift_id FOR UPDATE; END IF;
 UPDATE public.orders SET payment_method=p_method, card_amount=v_card,cash_amount=v_cash,cash_received=v_received,change_given=v_received-v_cash WHERE id=o.id RETURNING * INTO updated;
 IF o.shift_id IS NOT NULL THEN
 SELECT coalesce(sum(total),0),count(*),coalesce(sum(cash_amount),0) INTO v_sales,v_count,v_cash_total FROM public.orders WHERE shift_id=o.shift_id AND status IN ('open','completed','paid');
 SELECT coalesce(sum(CASE WHEN type='in' THEN amount WHEN type='out' THEN -amount ELSE 0 END),0) INTO v_ops FROM public.cash_operations WHERE shift_id=o.shift_id;
 UPDATE public.shifts SET sales_total=v_sales,orders_count=v_count,expected_cash=cash_start+v_cash_total+v_ops,cash_diff=CASE WHEN cash_end IS NULL THEN NULL ELSE cash_end-(cash_start+v_cash_total+v_ops) END WHERE id=o.shift_id;
 END IF;
 INSERT INTO public.audit_log(action,entity,entity_id,details) VALUES('payment_corrected','order',o.id,jsonb_build_object('user_id',auth.uid(),'before',p_expected,'after',jsonb_build_object('payment_method',updated.payment_method,'cash_amount',updated.cash_amount,'card_amount',updated.card_amount,'cash_received',updated.cash_received,'change_given',updated.change_given)));
 RETURN updated;
END;
$$;
REVOKE ALL ON FUNCTION public.correct_order_payment(uuid,text,integer,integer,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.correct_order_payment(uuid,text,integer,integer,jsonb) TO authenticated, service_role;