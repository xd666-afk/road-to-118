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

interface ReactorArtwork {
  file: string;
  portY: number;
  portWidth: number;
}

// The viewport shares the image's square box. These values were measured on each finished illustration.
export const advancedReactorArtwork: Partial<Record<number, ReactorArtwork>> = {
  6: { file: 'reactor-vi.webp', portY: 42.4, portWidth: 27.5 },
  7: { file: 'reactor-vii.webp', portY: 39.8, portWidth: 26.7 },
  8: { file: 'reactor-viii.webp', portY: 40.8, portWidth: 28.5 },
};
