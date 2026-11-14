// A strip of flat palette tiles, each either a plain block or a block with
// one simple shape cut into it (disc, half-disc, quarter-disc, diamond) --
// the geometric band the reference site (loopsii.com) runs under its hero,
// redrawn in this app's own four colours. Purely decorative: aria-hidden,
// no text, no meaning carried by any tile. Plain divs and border-radius
// rather than an SVG or an image so it costs nothing to load and recolours
// itself from the tokens.
//
// The pattern is a fixed list, not random -- a server render and a client
// render have to agree, and a hand-placed sequence reads as composed where
// Math.random() reads as noise.

type Tone = "accent" | "periwinkle" | "sand" | "surface" | "canvas";
type Shape =
  | "none"
  | "disc"
  | "half-top"
  | "half-bottom"
  | "quarter-tl"
  | "quarter-br"
  | "diamond";

interface Tile {
  bg: Tone;
  shape?: Shape;
  fg?: Tone;
}

const TONE: Record<Tone, string> = {
  accent: "bg-accent",
  periwinkle: "bg-accent-fill",
  sand: "bg-sand",
  surface: "bg-surface",
  canvas: "bg-canvas",
};

const SHAPE: Record<Exclude<Shape, "none">, string> = {
  disc: "inset-[12%] rounded-full",
  "half-top": "inset-x-0 top-0 h-1/2 rounded-b-full",
  "half-bottom": "inset-x-0 bottom-0 h-1/2 rounded-t-full",
  "quarter-tl": "inset-0 rounded-tl-full",
  "quarter-br": "inset-0 rounded-br-full",
  diamond: "inset-[18%] rotate-45",
};

// 12 columns x 3 rows, read left to right, top to bottom.
const PATTERN: Tile[] = [
  { bg: "sand" },
  { bg: "canvas" },
  { bg: "periwinkle", shape: "quarter-tl", fg: "accent" },
  { bg: "canvas" },
  { bg: "surface", shape: "disc", fg: "sand" },
  { bg: "accent" },
  { bg: "canvas" },
  { bg: "sand", shape: "half-bottom", fg: "periwinkle" },
  { bg: "canvas" },
  { bg: "periwinkle" },
  { bg: "canvas", shape: "diamond", fg: "accent" },
  { bg: "sand" },

  { bg: "accent", shape: "quarter-br", fg: "periwinkle" },
  { bg: "periwinkle" },
  { bg: "surface" },
  { bg: "sand", shape: "disc", fg: "accent" },
  { bg: "periwinkle", shape: "half-top", fg: "surface" },
  { bg: "sand" },
  { bg: "accent", shape: "disc", fg: "canvas" },
  { bg: "surface" },
  { bg: "accent", shape: "quarter-tl", fg: "sand" },
  { bg: "sand" },
  { bg: "periwinkle", shape: "disc", fg: "surface" },
  { bg: "accent" },

  { bg: "canvas" },
  { bg: "sand", shape: "half-top", fg: "accent" },
  { bg: "accent" },
  { bg: "canvas" },
  { bg: "sand" },
  { bg: "periwinkle", shape: "quarter-br", fg: "surface" },
  { bg: "canvas" },
  { bg: "periwinkle" },
  { bg: "surface", shape: "diamond", fg: "periwinkle" },
  { bg: "canvas" },
  { bg: "accent", shape: "half-bottom", fg: "sand" },
  { bg: "canvas" },
];

export function Mosaic({
  rows = 3,
  className = "",
}: {
  // The login panel only has room for the first two rows.
  rows?: 2 | 3;
  className?: string;
}) {
  const tiles = PATTERN.slice(0, rows * 12);
  return (
    <div
      aria-hidden="true"
      // Phones show the first six columns of each row (every tile past the
      // sixth in its row is hidden) -- twelve across would be 30px tiles.
      className={`grid grid-cols-6 sm:grid-cols-12 ${className}`}
    >
      {tiles.map((tile, index) => (
        <div
          key={index}
          className={`mosaic-tile relative aspect-square overflow-hidden ${TONE[tile.bg]} ${
            index % 12 >= 6 ? "max-sm:hidden" : ""
          }`}
        >
          {tile.shape && tile.shape !== "none" && tile.fg ? (
            <span
              className={`absolute ${SHAPE[tile.shape]} ${TONE[tile.fg]}`}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
