export type LandingVersion = { slug: string; name: string; idea: string; refs: string };

export const GENERATIONS: { id: string; note: string; versions: LandingVersion[] }[] = [
  {
    id: "v6",
    note: "One page that joins the strongest pieces into a single story.",
    versions: [
      { slug: "blend", name: "Blend", idea: "Hero with the intact mark, a short chat stamp, then Surf. Dark by default with a footer theme switch.", refs: "Names chat + Surf + dashboard nav" },
    ],
  },
  {
    id: "v5",
    note: "A blank slate: five different kinds of experience, each built from something the product does.",
    versions: [
      { slug: "lookalike-6", name: "Lookalike 6", idea: "Lookalike 5 with a group that talks crypto, a highlighted @you, and a real wallet home, send and review flow.", refs: "Forked from Lookalike 5" },
      { slug: "surf", name: "Surf", idea: "A real browser chrome with Etherscan, X, Uniswap and DeBank. Tag once via the chip → card → panel flow; the name follows you across tabs.", refs: "Today's extension chips, glance card, floating panel" },
    ],
  },
  {
    id: "v4",
    note: "Rebuilt: two favorites at a time, joined by one new interaction.",
    versions: [
      { slug: "reveal", name: "Reveal", idea: "A story written in addresses that you read with a lens. Names you find stay found.", refs: "Lens v1 + Names v3. New: read with a lens, lens-shaped color changes" },
    ],
  },
  {
    id: "v3",
    note: "One strong visual world each, after studying 29 sites.",
    versions: [
      { slug: "names", name: "Names", idea: "Tactile, colorful tags you can throw, a chat that gets stamped, and full-page color changes.", refs: "ENS, Phantom, Family. Split-flap wordmark footer" },
    ],
  },
  {
    id: "v1",
    note: "The first round.",
    versions: [
      { slug: "story", name: "Story", idea: "The logo comes apart as you scroll and tells the product story piece by piece.", refs: "Scrollytelling, parallax depth, full-bleed brand footer" },
    ],
  },
];
