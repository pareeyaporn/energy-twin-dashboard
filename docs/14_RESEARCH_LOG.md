

## Pass 9 (November 2026, IL-TRM measure costs for sensors and HVAC equipment)

From the saved IL-TRM v14.0 Vol. 2 PDF.

| Item | Before | Now | Source |
| --- | --- | --- | --- |
| Occupancy sensor cost | $0.25 / $0.40 / $0.65 per ft² (placeholder) | **$0.22 / $0.36 / $0.50** per ft² of common area | TRM 4.5.10: $55 wall-switch, $67 fixture-mounted, $125 remote or wall-mounted per sensor; **250 ft² per sensor is an assumption** |
| HVAC equipment cost | $2.00 per ft² for every system (placeholder) | rooftop units **$895 / $958 / $1,021 per ton** (base / CEE Tier 1 / Tier 2); PTAC and PTHP **$1,047 per ton** (−15% / +25% placeholder spread); central plant **boiler $22.95/kBtu/h** (low $12.94) + chiller **$1.31/ft² placeholder**; VRF $2.00/ft² placeholder | TRM 4.4.15 (full install cost, <135 kBtu/h), 4.4.13 (early replacement, full cost), 4.4.10; TRM 4.4.6 gives only incremental chiller costs ($23–830/ton) |
| LED retrofit cost | placeholder | unchanged; **lower bound recorded**: TRM 4.5.4 time-of-sale incremental costs about $0.70–1.50 per watt removed (2012 DOE prices, no labor) vs the model's ~$2.33 per watt | TRM 4.5.4 |
| Energy management cost | placeholder | unchanged; the TRM has no EMS measure | — |

Bug fixed: the PTAC/PTHP hotels' common-area rooftop units showed a capacity 1,000 times too large in the Equipment view (display only).

**Effect:** LED + occupancy sensors at $50,000 costs $38,940 (was $39,600), $24,184 net, payback 2.3 years under the 85% scenario (2.7 on the baseline);
sensors alone pay back in under a year. Central-plant HVAC is unchanged in total ($109,918) but now split into a sourced and a placeholder part.
No recommendation changes.
