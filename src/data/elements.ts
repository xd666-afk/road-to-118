/** Static element data. Layout follows an 18-column table with detached La–Lu / Ac–Lr rows. */
export type ElementCategory =
  | 'nonmetal' | 'noble' | 'alkali' | 'alkaline' | 'metalloid'
  | 'halogen' | 'transition' | 'post-transition' | 'lanthanide' | 'actinide';

export interface ElementInfo {
  z: number;
  symbol: string;
  name: string;
  english: string;
  /** CSS grid column. For detached f-block entries this is not a group assignment. */
  col: number;
  /** Main table: 1–7; detached lanthanides: 9; detached actinides: 10. */
  row: number;
  period: number;
  category: ElementCategory;
  color: string;
  /** Conventional rounded relative atomic mass, supplied for the playable first ten. */
  mass?: string;
  specimenDescription?: string;
}

// Official names and symbols: IUPAC. Simplified Chinese nomenclature uses the
// standard CJK extension characters rather than silently substituting old names.
const NAMES: readonly (readonly [string, string, string])[] = [
  ['H', '氢', 'Hydrogen'], ['He', '氦', 'Helium'],
  ['Li', '锂', 'Lithium'], ['Be', '铍', 'Beryllium'],
  ['B', '硼', 'Boron'], ['C', '碳', 'Carbon'],
  ['N', '氮', 'Nitrogen'], ['O', '氧', 'Oxygen'],
  ['F', '氟', 'Fluorine'], ['Ne', '氖', 'Neon'],
  ['Na', '钠', 'Sodium'], ['Mg', '镁', 'Magnesium'],
  ['Al', '铝', 'Aluminium'], ['Si', '硅', 'Silicon'],
  ['P', '磷', 'Phosphorus'], ['S', '硫', 'Sulfur'],
  ['Cl', '氯', 'Chlorine'], ['Ar', '氩', 'Argon'],
  ['K', '钾', 'Potassium'], ['Ca', '钙', 'Calcium'],
  ['Sc', '钪', 'Scandium'], ['Ti', '钛', 'Titanium'],
  ['V', '钒', 'Vanadium'], ['Cr', '铬', 'Chromium'],
  ['Mn', '锰', 'Manganese'], ['Fe', '铁', 'Iron'],
  ['Co', '钴', 'Cobalt'], ['Ni', '镍', 'Nickel'],
  ['Cu', '铜', 'Copper'], ['Zn', '锌', 'Zinc'],
  ['Ga', '镓', 'Gallium'], ['Ge', '锗', 'Germanium'],
  ['As', '砷', 'Arsenic'], ['Se', '硒', 'Selenium'],
  ['Br', '溴', 'Bromine'], ['Kr', '氪', 'Krypton'],
  ['Rb', '铷', 'Rubidium'], ['Sr', '锶', 'Strontium'],
  ['Y', '钇', 'Yttrium'], ['Zr', '锆', 'Zirconium'],
  ['Nb', '铌', 'Niobium'], ['Mo', '钼', 'Molybdenum'],
  ['Tc', '锝', 'Technetium'], ['Ru', '钌', 'Ruthenium'],
  ['Rh', '铑', 'Rhodium'], ['Pd', '钯', 'Palladium'],
  ['Ag', '银', 'Silver'], ['Cd', '镉', 'Cadmium'],
  ['In', '铟', 'Indium'], ['Sn', '锡', 'Tin'],
  ['Sb', '锑', 'Antimony'], ['Te', '碲', 'Tellurium'],
  ['I', '碘', 'Iodine'], ['Xe', '氙', 'Xenon'],
  ['Cs', '铯', 'Caesium'], ['Ba', '钡', 'Barium'],
  ['La', '镧', 'Lanthanum'], ['Ce', '铈', 'Cerium'],
  ['Pr', '镨', 'Praseodymium'], ['Nd', '钕', 'Neodymium'],
  ['Pm', '钷', 'Promethium'], ['Sm', '钐', 'Samarium'],
  ['Eu', '铕', 'Europium'], ['Gd', '钆', 'Gadolinium'],
  ['Tb', '铽', 'Terbium'], ['Dy', '镝', 'Dysprosium'],
  ['Ho', '钬', 'Holmium'], ['Er', '铒', 'Erbium'],
  ['Tm', '铥', 'Thulium'], ['Yb', '镱', 'Ytterbium'],
  ['Lu', '镥', 'Lutetium'], ['Hf', '铪', 'Hafnium'],
  ['Ta', '钽', 'Tantalum'], ['W', '钨', 'Tungsten'],
  ['Re', '铼', 'Rhenium'], ['Os', '锇', 'Osmium'],
  ['Ir', '铱', 'Iridium'], ['Pt', '铂', 'Platinum'],
  ['Au', '金', 'Gold'], ['Hg', '汞', 'Mercury'],
  ['Tl', '铊', 'Thallium'], ['Pb', '铅', 'Lead'],
  ['Bi', '铋', 'Bismuth'], ['Po', '钋', 'Polonium'],
  ['At', '砹', 'Astatine'], ['Rn', '氡', 'Radon'],
  ['Fr', '钫', 'Francium'], ['Ra', '镭', 'Radium'],
  ['Ac', '锕', 'Actinium'], ['Th', '钍', 'Thorium'],
  ['Pa', '镤', 'Protactinium'], ['U', '铀', 'Uranium'],
  ['Np', '镎', 'Neptunium'], ['Pu', '钚', 'Plutonium'],
  ['Am', '镅', 'Americium'], ['Cm', '锔', 'Curium'],
  ['Bk', '锫', 'Berkelium'], ['Cf', '锎', 'Californium'],
  ['Es', '锿', 'Einsteinium'], ['Fm', '镄', 'Fermium'],
  ['Md', '钔', 'Mendelevium'], ['No', '锘', 'Nobelium'],
  ['Lr', '铹', 'Lawrencium'], ['Rf', '𬬻', 'Rutherfordium'],
  ['Db', '𬭊', 'Dubnium'], ['Sg', '𬭳', 'Seaborgium'],
  ['Bh', '𬭛', 'Bohrium'], ['Hs', '𬭶', 'Hassium'],
  ['Mt', '鿏', 'Meitnerium'], ['Ds', '𫟼', 'Darmstadtium'],
  ['Rg', '𬬭', 'Roentgenium'], ['Cn', '鿔', 'Copernicium'],
  ['Nh', '鿭', 'Nihonium'], ['Fl', '𫓧', 'Flerovium'],
  ['Mc', '镆', 'Moscovium'], ['Lv', '𫟷', 'Livermorium'],
  ['Ts', '鿬', 'Tennessine'], ['Og', '鿫', 'Oganesson'],
];

function position(z: number): [number, number] {
  if (z === 1) return [1, 1];
  if (z === 2) return [18, 1];
  if (z <= 10) return [z <= 4 ? z - 2 : z + 8, 2];
  if (z <= 18) return [z <= 12 ? z - 10 : z, 3];
  if (z <= 36) return [z - 18, 4];
  if (z <= 54) return [z - 36, 5];
  if (z <= 56) return [z - 54, 6];
  if (z <= 71) return [z - 54, 9];
  if (z <= 86) return [z - 68, 6];
  if (z <= 88) return [z - 86, 7];
  if (z <= 103) return [z - 86, 10];
  return [z - 100, 7];
}

function category(z: number, col: number): ElementCategory {
  if (z >= 57 && z <= 71) return 'lanthanide';
  if (z >= 89 && z <= 103) return 'actinide';
  if (col === 18) return 'noble';
  if (col === 17) return 'halogen';
  if (col === 1 && z !== 1) return 'alkali';
  if (col === 2) return 'alkaline';
  if ([5, 14, 32, 33, 51, 52].includes(z)) return 'metalloid';
  if ([1, 6, 7, 8, 15, 16, 34].includes(z)) return 'nonmetal';
  if (col >= 3 && col <= 12) return 'transition';
  return 'post-transition';
}

const CATEGORY_COLORS: Record<ElementCategory, string> = {
  nonmetal: '#9acbc3', noble: '#e4b47e', alkali: '#c4a897',
  alkaline: '#cabd8c', metalloid: '#a9b3a2', halogen: '#bcc58c',
  transition: '#9aaebe', 'post-transition': '#b1bdc4',
  lanthanide: '#b2a5bd', actinide: '#bd9ca5',
};

const PLAYABLE_COLORS = [
  '#bddde2', '#dbb991', '#b8c1cc', '#a2b8b7', '#c4a57f',
  '#939ca6', '#9baedb', '#db9991', '#c1cc8a', '#f3a56f',
];
const PLAYABLE_MASSES = ['1.008', '4.0026', '6.94', '9.0122', '10.81', '12.011', '14.007', '15.999', '18.998', '20.180'];
const SPECIMENS = [
  '常温下为无色气体。样本瓶中的微光仅用于示意，不能代表氢气本身的颜色。',
  '常温下为无色气体。透明密封样本与仪表反光，不把氦画成可见的彩色云团。',
  '柔软的银白色金属，切面呈金属光泽。画面为密闭条件下的示意样本。',
  '银白色、低密度的金属样本，带细微表面纹理；不把祖母绿矿石误画成纯铍。',
  '深棕黑色的无定形粉末样本；硼的不同结构具有不同外观。',
  '黑灰色、有微弱金属光泽的石墨片；石墨和金刚石都是碳的同素异形体。',
  '常温下为无色气体。画面使用透明样本容器；液氮冷雾也不是氮气本身的颜色。',
  '常温下为无色气体，液态氧呈淡蓝色。当前常温气体样本不显示蓝色烟雾。',
  '很淡的黄绿色气体。画面仅为耐蚀密闭观察窗内的虚拟样本，不表示可直接接触。',
  '常温下为无色气体；低压放电时发出橙红色光。发光展示需明确标注为放电状态。',
];

export const ELEMENTS: ElementInfo[] = NAMES.map(([symbol, name, english], i) => {
  const z = i + 1;
  const [col, row] = position(z);
  const kind = category(z, col);
  return {
    z, symbol, name, english, col, row,
    period: row === 9 ? 6 : row === 10 ? 7 : row,
    category: kind,
    color: PLAYABLE_COLORS[i] ?? CATEGORY_COLORS[kind],
    ...(i < 10 ? { mass: PLAYABLE_MASSES[i], specimenDescription: SPECIMENS[i] } : {}),
  };
});

export function element(z: number): ElementInfo {
  const found = ELEMENTS[z - 1];
  if (!found || !Number.isInteger(z)) throw new RangeError(`Unknown atomic number: ${z}`);
  return found;
}

export interface KnowledgeCard {
  title: string;
  fact: string;
  application: string;
  unlock: string;
  source: string;
}

export const KNOWLEDGE: Record<number, KnowledgeCard> = {
  1: {
    title: '从最轻的元素出发',
    fact: '氢的原子序数是1，原子核中有1个质子。常温氢气无色、无味，是密度最低的气体；屏幕上的粒子颜色只用于辨认元素。',
    application: '氢可用于燃料电池，也广泛用于化工生产。它与氧反应生成水，但现实中的元素转变涉及原子核，不能靠普通化学碰撞完成。',
    unlock: '游戏中：两份保底活跃样本维持起步碰撞；可提交库存与活跃样本分离。',
    source: 'https://periodic-table.rsc.org/element/1/hydrogen',
  },
  2: {
    title: '先在太阳上留下线索',
    fact: '氦是原子序数为2的稀有气体。科学家先在太阳光谱中观察到它的特征谱线，后来才在地球上发现它，因此英文名称源自“太阳”。',
    application: '液氦能提供极低温环境，可用于冷却磁共振成像设备的超导磁体。氦气本身无色，容器内的识别色并非它的真实外观。',
    unlock: '游戏中：开始生产氦；累计提交50单位后正式点亮，发现锂无需先收录氦。',
    source: 'https://periodic-table.rsc.org/element/2/helium',
  },
  3: {
    title: '轻盈的银白金属',
    fact: '锂是柔软的银白色金属，也是密度最低的金属。它属于碱金属，与氢、氦的常温气态外观明显不同；样本图展示的是金属质感。',
    application: '含锂材料广泛用于手机、电脑和电动汽车的充电电池。电池中的锂以具体材料和离子形式参与过程，并不等于把纯锂金属直接装进所有电池。',
    unlock: '游戏中：继续向铍开展探索；发现进度与50单位收录进度分别计算。',
    source: 'https://periodic-table.rsc.org/element/3/lithium',
  },
  4: {
    title: '轻质材料的新边界',
    fact: '铍是银白色、低密度的金属，原子序数为4。它存在于绿柱石等矿物中，但祖母绿等矿物的颜色不能代表纯铍的颜色。',
    application: '铍及其合金可用于航空航天结构和精密部件；薄铍片还能用于需要透过X射线的窗口。铍及其化合物有毒，知识卡只展示科学信息。',
    unlock: '游戏中：首次发现铍即开放II型受控反应容器研发，无需提交50铍。',
    source: 'https://periodic-table.rsc.org/element/4/beryllium',
  },
  5: {
    title: '玻璃里的耐热线索',
    fact: '硼属于类金属，原子序数为5。无定形硼可呈深色粉末；元素、矿物和含硼化合物的外观与性质不能直接混为一谈。',
    application: '硼的化合物用于硼硅酸盐玻璃，使玻璃更耐热；同位素硼-10具有较强的中子吸收能力，也用于相关科学探测材料。',
    unlock: '游戏中：II型适合推进硼的探索；I型仍保留极低但非零的成功机会。',
    source: 'https://periodic-table.rsc.org/element/5/boron',
  },
  6: {
    title: '同一种元素，不同的世界',
    fact: '石墨、金刚石和石墨烯都由碳组成。原子的连接方式不同，会形成性质差异巨大的同素异形体；黑色石墨与透明金刚石都可以是纯碳。',
    application: '石墨用于铅笔芯、电机电刷等，金刚石用于切割与钻探。碳还能形成牢固的链状结构，是有机化学和生命物质的重要基础。',
    unlock: '游戏中：继续推进氮的探索；旧容器重复生产碳也可触发对应越级成就。',
    source: 'https://periodic-table.rsc.org/element/6/carbon',
  },
  7: {
    title: '空气中的安静主角',
    fact: '氮的原子序数为7，常温氮气无色、无味。氮是氨基酸以及DNA、RNA等物质的重要组成元素，参与自然界中的氮循环。',
    application: '氮气可为食品和电子工业提供较不活泼的保护气氛。液氮可用作低温冷却介质；常见白雾主要是周围空气中的水分凝结。',
    unlock: '游戏中：首次发现氮即开放III型先进装置研发，工业化进入新阶段。',
    source: 'https://periodic-table.rsc.org/element/7/nitrogen',
  },
  8: {
    title: '呼吸之外的工业力量',
    fact: '氧的原子序数为8，常温氧气无色、无味。许多生物通过有氧呼吸获取能量；溶解在水中的氧也支持河流与海洋中的好氧生命。',
    application: '氧气的重要工业用途包括炼钢和污水处理。它能支持燃烧，但不应把“助燃”误写成“氧气本身是燃料”；液氧的淡蓝色也不等于气态氧有色。',
    unlock: '游戏中：III型更适合氧及后续元素；II型成功生产氧可获得越级徽章。',
    source: 'https://periodic-table.rsc.org/element/8/oxygen',
  },
  9: {
    title: '活泼元素与稳定材料',
    fact: '氟是原子序数为9的卤素，单质为很淡的黄绿色气体，反应性很强。含氟化合物的性质可能与单质氟完全不同，不能凭元素名称互相替代。',
    application: '聚四氟乙烯等含氟聚合物可用于不粘涂层和电缆绝缘。牙膏中的氟化物也不是氟气；单质氟具有毒性，样本画面仅为虚拟展示。',
    unlock: '游戏中：氟之后的唯一新发现目标是氖，接近v0.1的最终里程碑。',
    source: 'https://periodic-table.rsc.org/element/9/fluorine',
  },
  10: {
    title: '橙红光中的第一座里程碑',
    fact: '氖是原子序数为10的稀有气体，常温下无色、无味。它在低压放电管中发出橙红色光；其他颜色的“霓虹灯”常使用不同气体或发光材料。',
    application: '氖用于发光标识、指示装置及部分激光器。发光来自受激原子的能量变化，并不表示普通氖气在日常条件下会自行持续发光。',
    unlock: '游戏中：首次发现氖触发里程碑；累计提交50氖完成v0.1，之后可自由收集。',
    source: 'https://periodic-table.rsc.org/element/10/neon',
  },
};

export const SCIENCE_NOTE = '碰撞能资源、合成概率和H→Ne生成顺序均为游戏机制，不代表真实核反应条件或路线。粒子大小、颜色与轨迹为示意，大小不表示真实原子半径；现实中的原子无法肉眼直接看见。';

export const TABLE_SOURCES = [
  'https://iupac.org/what-we-do/periodic-table-of-elements/',
  'https://iupac.org/iupac-announces-the-names-of-the-elements-113-115-117-and-118/',
  'https://www.nist.gov/system/files/documents/2024/06/25/NIST_periodictable_June24_iupac.pdf',
  'https://www.cnctst.cn/news/mtsm/202308/t20230823_760185.html',
];
