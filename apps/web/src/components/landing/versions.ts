export type LandingVersion = { slug: string; name: string; idea: string; refs: string };

export const GENERATIONS: { id: string; note: string; versions: LandingVersion[] }[] = [
  {
    id: "v6",
    note: "Ten places, three acts each. You do the job inside the page.",
    versions: [
      { slug: "operator", name: "Operator", idea: "A night telephone exchange. Lift a trunk, seat a cord on a name, watch the lamp come on in three cities, and hear a lookalike short the board.", refs: "Bell System switchboards" },
      { slug: "fixer", name: "Fixer", idea: "A safelight darkroom. Hold the paper in the bath until an address develops, caption it, then try to hang a private print on the public wall.", refs: "Darkroom photography" },
      { slug: "flaps", name: "Flaps", idea: "A split-flap departures board. Name a flight, send the same passenger across chains, and watch a near-identical flight refuse the callsign.", refs: "Solari boards" },
      { slug: "score", name: "Score", idea: "A manuscript. Title the motif, see it copied onto four staves, and hear a forged bar jump off the staff when it steals the title.", refs: "Handwritten scores" },
      { slug: "station", name: "Station", idea: "A field weather station. Chalk a name on the slate, watch the needles settle over three sites, and see a false front set the needle hunting.", refs: "Weather-station logs" },
      { slug: "booth", name: "Booth", idea: "A projection booth. Splice a title into the reel, then an intermission slide shows the dialogue never leaves the booth.", refs: "Cinema title cards" },
      { slug: "slots", name: "Slots", idea: "A sorting office. Drop envelopes into pigeonholes, bounce a lookalike back out, and carry the holes to three windows.", refs: "Postal pigeonholes" },
      { slug: "lining", name: "Lining", idea: "A tailor's coat. Sew the name into the lining, button it for the street, and turn it. A twin coat has an empty lining.", refs: "Bespoke tailoring" },
      { slug: "night", name: "Night", idea: "A hotel ledger under a green lamp. Sign a guest, cut four keys, and watch the lobby plaque refuse a private name.", refs: "Night-audit books" },
      { slug: "atlas", name: "Atlas", idea: "A sea chart. Ink a coast, carry the name onto the next plate, and watch the ink run off a phantom island.", refs: "Portolan charts, phantom islands" },
    ],
  },
  {
    id: "v5",
    note: "A blank slate: five different kinds of experience, each built from something the product does.",
    versions: [
      { slug: "lookalike", name: "Lookalike", idea: "A game: find Alice among near-identical addresses, then play again with tags turned on.", refs: "neal.fun, address poisoning research" },
      { slug: "lookalike-2", name: "Lookalike 2", idea: "No start button: the page opens mid-task, with Alice waiting to be paid and every row a Send button.", refs: "Refined Lookalike, real wallet Send screens" },
      { slug: "lookalike-3", name: "Lookalike 3", idea: "The original's clean look with no start button: the first screen is already round one.", refs: "Original Lookalike" },
      { slug: "lookalike-big", name: "Lookalike Big", idea: "The addresses are the design: huge, edge to edge, and the whole screen is the game.", refs: "Same concept, new execution" },
      { slug: "lookalike-4", name: "Lookalike 4", idea: "A group chat and your wallet: copy Alice's address, pay her, lose the message, then find her again in your history.", refs: "Real chats and wallets" },
      { slug: "lookalike-5", name: "Lookalike 5", idea: "One moment at a time: copy from a chat, the wallet rises, weeks fly past, and your history is full of lookalikes.", refs: "Lookalike 4's story, as motion" },
      { slug: "lookalike-6", name: "Lookalike 6", idea: "Lookalike 5 with a group that talks crypto, a highlighted @you, and a real wallet home, send and review flow.", refs: "Forked from Lookalike 5" },
      { slug: "case", name: "Case File", idea: "A detective board with no scrolling: tie evidence together with string to work out who's behind a wallet.", refs: "tldraw, Case File #001, Teenage Engineering's humor" },
      { slug: "rolodex", name: "Rolodex", idea: "One giant card file. Scrolling turns the wheel, every feature is a card, and the last one is blank for you.", refs: "Stripe Press, rotary card files" },
      { slug: "receipt", name: "Receipt", idea: "The page is a receipt you print by scrolling and tear off to sign up. Funds held: 0.00.", refs: "Teenage Engineering's voice, thermal printers" },
      { slug: "surf", name: "Surf", idea: "A tiny fictional internet. The extension sits in the toolbar, and your tags follow you from site to site.", refs: "Poolsuite, simulated browsers" },
    ],
  },
  {
    id: "v4",
    note: "Rebuilt: two favorites at a time, joined by one new interaction.",
    versions: [
      { slug: "stamp", name: "Stamp", idea: "Drag a real tag onto an address. It stamps on, and a wave names that wallet across the page.", refs: "Names v3 + Compare v2. New: drag to tag" },
      { slug: "reveal", name: "Reveal", idea: "A story written in addresses that you read with a lens. Names you find stay found.", refs: "Lens v1 + Names v3. New: read with a lens, lens-shaped color changes" },
      { slug: "hang", name: "Hang", idea: "One rope runs through the whole page holding everything. It swings as you scroll, then snaps.", refs: "Tags v1 + Names v3. New: one continuous rope" },
      { slug: "keep", name: "Keep", idea: "Your tag stays on its string the whole way, clipping onto each site as you scroll.", refs: "Yours v3 + Tags v1. New: one tag that never leaves" },
      { slug: "try", name: "Try", idea: "Type a name right on the page, hold to see life without it, and wipe from site to site.", refs: "Compare v2 + Yours v3. New: tag in place, hold to compare" },
    ],
  },
  {
    id: "v3",
    note: "One strong visual world each, after studying 29 sites.",
    versions: [
      { slug: "names", name: "Names", idea: "Tactile, colorful tags you can throw, a chat that gets stamped, and full-page color changes.", refs: "ENS, Phantom, Family. Split-flap wordmark footer" },
      { slug: "light", name: "Light", idea: "An eclipse lights the whole page and follows your cursor, with wallets orbiting it.", refs: "Mesh, Raycast, Resend. Live shader, orbit, lit wordmark" },
      { slug: "yours", name: "Yours", idea: "Paste a real address, make your own tag on a lanyard, then watch it travel across the web.", refs: "Vercel Ship badge, Rainbow. Real address detection" },
    ],
  },
  {
    id: "v2",
    note: "Clearer product ideas and calmer layouts, built from what could work in v1.",
    versions: [
      { slug: "compare", name: "Compare", idea: "Wipe across a real explorer page and watch raw addresses turn into names.", refs: "Lens + Playground. Before/after slider, wipe footer" },
      { slug: "inline", name: "Inline", idea: "Type first: addresses inside the sentences decode into names as you read.", refs: "Scramble text, pinned narrative, large type rows" },
      { slug: "cards", name: "Cards", idea: "Identities live in a wallet. Pull out cards, stack them on scroll, and the footer is the wallet.", refs: "Story + Tags. Wallet cards, sticky stack" },
      { slug: "zoom", name: "Zoom", idea: "A tilted wall of the sites you use flattens and zooms into one tagged page.", refs: "3D marquee, container scroll, address-filled wordmark" },
      { slug: "search", name: "Search", idea: "The hero is a working command palette: look up a name or address and see the entity.", refs: "Command palette, bento, parallax columns, command-row footer" },
    ],
  },
  {
    id: "v1",
    note: "The first round.",
    versions: [
      { slug: "lens", name: "Lens", idea: "A lens follows your cursor across a wall of addresses and reveals who they are.", refs: "Spotlight effects, scroll-lit copy, proximity type" },
      { slug: "graph", name: "Graph", idea: "Scattered wallets drift on a canvas, then collapse into entities as you scroll.", refs: "Particles, cursor attraction, particle logo footer" },
      { slug: "tags", name: "Tags", idea: "Real tags hang from the top of the page. Throw them, then watch them pile into the footer.", refs: "Elastic lines, gravity physics, horizontal scroll" },
      { slug: "playground", name: "Playground", idea: "The hero is the product: tag an address, switch sites, and your tag follows you.", refs: "Live multiplayer demos, 3D container scroll, curtain footer" },
      { slug: "story", name: "Story", idea: "The logo comes apart as you scroll and tells the product story piece by piece.", refs: "Scrollytelling, parallax depth, full-bleed brand footer" },
    ],
  },
];
