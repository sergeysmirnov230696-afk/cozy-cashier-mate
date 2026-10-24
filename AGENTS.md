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
