<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- The cashier desktop workspace uses viewport-height grid tracks with separate catalogue and order-body scrolling; keep totals and payment outside the scrolling body so checkout stays visible.
- Both root and dark selectors share the same semantic palette to keep device themes consistent.
- Use shared sales accounting for admin reports: paid open/completed and legacy paid orders are sales; cancelled/refunded orders are excluded, and date ranges follow the shop's Almaty business day.
- Correct receipt payment splits through a role-checked transactional database function so the order, closed-shift cash totals, and audit record change together.
- Share the date-period control between admin sales reports and receipt history; custom ranges include both selected dates and use the same business-day conversion as presets.

- Persist cashier payment requests before transmission with a stable UUID; commit orders, items, stock, loyalty and audit atomically through the service-only sale RPC. Retain rejected queued sales with their original employee, shift and expected total.
- Cached cashier identity only enables the offline view within the session lifetime; every upload authenticates through the server PIN session. Offline receipts are provisional, not fiscal.
