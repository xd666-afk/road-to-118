const specimenAtlases = [
  { first: 1, last: 10, columns: 5, rows: 2, file: 'specimen-atlas.png' },
  { first: 11, last: 20, columns: 5, rows: 2, file: 'specimen-expansion-atlas.png' },
  { first: 21, last: 32, columns: 4, rows: 3, file: 'specimens-sc-ge.webp' },
  { first: 33, last: 44, columns: 4, rows: 3, file: 'specimens-as-ru.webp' },
  { first: 45, last: 54, columns: 5, rows: 2, file: 'specimens-rh-xe.webp' },
];

export function artworkUrl(file: string) {
  return `${import.meta.env.BASE_URL}assets/${file}`;
}

export function specimenImageStyle(z: number) {
  const atlas = specimenAtlases.find(({ first, last }) => first <= z && z <= last);
  if (!atlas) return;
  const { first, columns, rows, file } = atlas;
  const index = z - first;
  const x = (index % columns) * 100 / (columns - 1);
  const y = Math.floor(index / columns) * 100 / (rows - 1);
  return {
    backgroundImage: `url("${artworkUrl(file)}")`,
    backgroundSize: `${columns * 100}% ${rows * 100}%`,
    backgroundPosition: `${x}% ${y}%`,
  };
}

// Coordinates and usable glass diameter are percentages of the square image.
const reactorScenes = [
  { file: 'reactor-room-i.webp', aperture: { x: 50, y: 49.6, diameter: 14.4 } },
  { file: 'reactor-room-ii.webp', aperture: { x: 50, y: 50.4, diameter: 14.3 } },
  { file: 'reactor-room-iii.webp', aperture: { x: 50, y: 51.3, diameter: 13.8 } },
  { file: 'reactor-room-iv.webp', aperture: { x: 50, y: 52, diameter: 14 } },
  { file: 'reactor-room-v.webp', aperture: { x: 50, y: 48.4, diameter: 13.2 } },
  { file: 'reactor-room-vi.webp', aperture: { x: 50, y: 52.8, diameter: 15.7 } },
  { file: 'reactor-room-vii.webp', aperture: { x: 50, y: 50, diameter: 14.3 } },
  { file: 'reactor-room-viii.webp', aperture: { x: 50, y: 52.5, diameter: 14.3 } },
] as const;

export function reactorScene(id: number) {
  return reactorScenes[id - 1];
}
