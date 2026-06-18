---
description: Generate a test plan for the current change
---

Follow /Users/sladjan/git/twin/6_test_plan.md exactly. Use the current ticket context.

On completing this stage:
1. Call test_plan_save with:
   - id: "ticket-<ID>-<slug>" (e.g. "ticket-173690700-user-display-names")
   - radar_id: the ticket:// link
   - anchor_id: current session anchor_id if known
   - title: short description of what the plan covers
   - content: the complete markdown test plan
2. Emit [STAGE_COMPLETE | stage=TEST_PLAN | id=<id> | tests=<count>]
3. Offer: "Update the anchor with test plan reference?"
4. On confirm → call anchor_save with updated state referencing the test plan id.
