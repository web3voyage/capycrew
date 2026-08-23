# CapyCrew Web Whitepaper Research

Research date: 2026-08-20

## Reachable reference patterns

- [Ethereum Whitepaper](https://ethereum.org/en/whitepaper/) — long-form technical paper with a strong document title, sticky/readable content layout, section hierarchy, history/context, system mechanics, applications, token systems, and a final concerns section. The page describes itself as an introductory paper and uses a clear technical tone.
- [Axie Infinity Whitepaper](https://whitepaper.axieinfinity.com/) — compact, branded whitepaper with top-level narrative sections such as `Axie Infinity`, `Axie Infinity Universe`, `Community & Economy`, and `Mission`. This is a useful model for a consumer game/NFT project: story first, economy second, mission last.
- [World Chain developer docs](https://docs.world.org/world-chain/) — persistent documentation navigation organized into Overview, Using, Building, Infrastructure, Technical Reference, Tokens, and Further Reading. This is a good information-architecture reference for a routed web whitepaper.
- [Berachain docs](https://docs.berachain.com/) — combines an overview with an explicit protocol mechanism (`Proof of Liquidity`), tokens, governance, help, and an on-page table of contents. This demonstrates how to expose a core economic loop without burying it in prose.
- [Zora docs](https://docs.zora.co/) — documentation landing pattern with persistent top navigation, search, and a progressive-disclosure structure for technical readers.

Some Web3 project sites were inaccessible from this environment. These references are used for layout and information hierarchy, not as a request to copy branding or artwork.

## Recommended CapyCrew page model

Use `/whitepaper` as an editorial document rather than a single marketing splash page. Keep a sticky section rail on desktop and a collapsible jump menu on mobile. The first viewport should contain the paper title, version/date, a one-paragraph abstract, and two actions: `Explore the model` and `Download PDF` (the latter only when a real PDF exists).

Suggested sections:

1. **Abstract** — what CapyCrew is, who it is for, and what is live today. Avoid implying guaranteed returns or utility that does not yet exist.
2. **The World** — CapyCity, the characters, the 3D site experience, and the relationship between media, collectibles, and community.
3. **NFT Collection** — supply, mint status, metadata, video `animation_url` support, holder benefits, and what is still planned.
4. **The Signal / Product Loop** — how holders discover drops, content, events, and future experiences. Use a simple visual loop: Discover → Collect → Participate → Shape.
5. **Community & Governance** — current channels, moderation, proposal process, and what decisions are/are not on-chain.
6. **$MELLOW token model** — supply and allocation chart, release/vesting notes, distribution mechanics, and explicit status (`planned`, `not launched`, or `live`).
7. **Roadmap** — milestone-based and conditional, with dates only where committed. Separate shipped, in progress, and exploratory work.
8. **Technical architecture** — chain/network, contracts (when deployed), storage, metadata, wallet flow, and security review status.
9. **Risks & limitations** — smart-contract risk, phishing/scams, market volatility, regulatory uncertainty, liquidity risk, and roadmap uncertainty.
10. **Legal / Terms** — privacy link, terms, jurisdictional restrictions, no-investment-advice notice, and a contact route.

## Tokenomics presentation

The supplied plan totals 100% of a 1,000,000,000 token supply:

| Allocation | Share | Tokens | Display guidance |
|---|---:|---:|---|
| NFT holders | 20% | 200,000,000 | Say `planned allocation` unless a claim contract and eligibility rules are live. |
| On-chain holders | 20% | 200,000,000 | Define “on-chain holder” precisely before publishing. |
| Liquidity | 40% | 400,000,000 | Explain venue, lock/management policy, and whether this is initial or staged liquidity. |
| Marketing, future development & KOL | 10% | 100,000,000 | Add a disclosure policy and spending governance. |
| Team (1-year vest) | 10% | 100,000,000 | Clarify cliff, linear release schedule, wallet disclosure, and whether the 1 year starts at TGE. |

Use a donut/bar chart plus a plain table. Always show both percentage and exact token count. Include a visible “subject to final legal, technical, and governance review” note. Do not call the token an investment, promise appreciation, or imply a guaranteed holder yield.

## Visual direction

- Dark ink background, warm paper panels, and CapyCrew accent red/cyan/lime.
- Oversized chapter numerals, monospaced metadata labels, thin rules, and generous reading width (roughly 680–760px for body copy).
- Every major section gets one “evidence” block: a diagram, allocation chart, timeline, code/status card, or glossary—not decorative filler.
- Keep the 3D canvas behind the document at low opacity or disable it on `/whitepaper`; legibility wins on a reference page.
- Use scroll progress, active section highlighting, and subtle reveal transitions. Respect `prefers-reduced-motion`.
- On mobile, collapse the rail into a top select/menu, stack tokenomics cards, and avoid horizontal overflow.

## Language and compliance safeguards

- Mark unreleased features as `planned`, `prototype`, or `exploratory`.
- Use “may,” “intends to,” and “subject to” for roadmap benefits.
- Define NFT holder/on-chain holder eligibility and snapshot timing before launch.
- Add a risk statement near the token section, not only in the footer.
- Link to Privacy, Terms, official X, and Telegram. Warn that only links on the official domain are canonical.

## Source observations

The strongest shared pattern across the references is progressive disclosure: a concise overview for newcomers, persistent navigation for scanning, and deeper technical/economic sections for readers who want detail. CapyCrew should preserve its playful visual identity while adopting that information architecture and the explicit risks/status language of serious protocol docs.
