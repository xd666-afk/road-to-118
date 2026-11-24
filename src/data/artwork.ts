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

export function reactorImageStyle(id: number) {
  const cell = id - 1;
  return {
    backgroundImage: `url("${artworkUrl('reactor-series.webp')}")`,
    backgroundSize: '400% 200%',
    backgroundPosition: `${(cell % 4) * 100 / 3}% ${Math.floor(cell / 4) * 100}%`,
  };
}
