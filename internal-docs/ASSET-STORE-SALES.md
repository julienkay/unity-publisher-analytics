# Asset Store sale calendar

The runtime calendar is [`data/asset-store-sales.json`](../data/asset-store-sales.json).
Each item contains only a title, a start date, and an end date. Both dates are
inclusive.

The calendar includes Unity-operated promotions for individually purchasable
assets. It excludes bundle-only offers and single-publisher promotions. A date
match means that a campaign was active. It does not prove that a specific asset
participated in the campaign.

## Public sources

The initial calendar used these source groups:

- Official Unity forum announcements and Unity blog posts.
- Unity Asset Store campaign schedules embedded in the public home page.
- Contemporary publisher and Reddit announcements.
- Public Unity marketing-email archives on Milled.
- The [Good Luck Net Life sale archive](https://goodlucknetlife.com/unity-assetstore-sale/).
- The [Asopoyo sale archive](https://essence-of-human-game-creation.com/unity-assets-sales-history/).

The investigation also compared recent ranges with private marketing emails.
The repository contains no private email content or account information.

The Reboot 2020 end date is less certain than the other ranges. A contemporary
forum post calculated it from the duration in a marketing email. Historical
sources can also differ by one calendar day because they use different time
zones.

## Update procedure

1. Run `npm run inspect:sale` while a sale is active.
2. Compare the result with a public Unity announcement when one is available.
3. Add the title, start date, and end date to the runtime calendar.
4. Run `npm run test:sales`.

The Asset Store page structure is undocumented. A failed inspection does not
prove that no sale is active.
