import { EXPANDED_ATOMS } from './expansion';
import { EXPANDED54_ATOMS } from './expansion54';
/** Neutral, ground-state atoms. RSC element pages are linked from KNOWLEDGE.
 * The selected isotope is explicit: relative atomic mass is never rounded to
 * manufacture a neutron count. Thermal values are approximate, in Celsius.
 */
export interface AtomicProfile {
  isotope: number;
  configuration: string;
  shells: readonly number[];
  group: number;
  state: '气态' | '液态' | '固态';
  melting: string;
  boiling: string;
  chemistry: string;
  isotopes: string;
  occurrence: string;
  extraSource?: { label: string; url: string };
}

export const ATOMIC_PROFILES: Record<number, AtomicProfile> = {
  1: {
    isotope: 1, configuration: '1s¹', shells: [1], group: 1, state: '气态', melting: '−259.16 °C', boiling: '−252.88 °C',
    chemistry: '氢原子只有一个电子，位于第一电子层。两个氢原子可以共用电子，组成 H₂ 分子；普通氢气主要以这种双原子分子存在。氢与氧生成水属于化学反应，原子核中的质子数不会因此改变。',
    isotopes: '氕（氢-1）没有中子，氘（氢-2）有 1 个中子，氚（氢-3）有 2 个中子。它们都只有 1 个质子；氚具有放射性。',
    occurrence: '氢在太阳和其他恒星中十分丰富。地球上的氢主要结合在水和许多有机物中，游离氢气在大气中含量很低。',
  },
  2: {
    isotope: 4, configuration: '1s²', shells: [2], group: 18, state: '气态', melting: '常压下不凝固', boiling: '−268.93 °C',
    chemistry: '氦的第一电子层已有 2 个电子，形成满层结构，因此通常很难参与化学反应。它在普通条件下以单原子气体存在。氦的沸点极低，液氦能提供许多其他液体无法达到的低温环境。',
    isotopes: '天然氦主要是氦-4，含 2 个质子和 2 个中子；稀少的氦-3 含 2 个质子和 1 个中子。两者都是稳定同位素，中性原子都含 2 个电子。',
    occurrence: '氦既存在于恒星中，也可由地壳中某些放射性元素的衰变产生。工业上常从含氦天然气中分离获得。',
    extraSource: { label: 'PubChem · 氦的相变', url: 'https://pubchem.ncbi.nlm.nih.gov/element/2' },
  },
  3: {
    isotope: 7, configuration: '1s² 2s¹', shells: [2, 1], group: 1, state: '固态', melting: '180.50 °C', boiling: '1342 °C',
    chemistry: '锂有 3 个电子，分布在两层中，最外层只有 1 个。它在许多化合物中形成 Li⁺ 离子，此时电子数由 3 变为 2，但原子核仍有 3 个质子。锂金属能与水反应。',
    isotopes: '锂-6 和锂-7 都是稳定同位素，分别有 3 个和 4 个中子。天然锂以锂-7 为主，因此这张卡以锂-7 展示中子数。',
    occurrence: '锂通常以化合物形式存在于矿物和盐卤中。锂辉石、锂云母等矿物，以及含锂盐卤，都是重要的资源来源。',
  },
  4: {
    isotope: 9, configuration: '1s² 2s²', shells: [2, 2], group: 2, state: '固态', melting: '1287 °C', boiling: '2468 °C',
    chemistry: '铍有 4 个电子，最外层为 2 个；其化合物中常见的氧化态为 +2。铍兼具低密度和较高刚性，适合某些精密结构。它及其化合物具有毒性，不能把材料用途理解为可以随意接触。',
    isotopes: '铍-9 含 4 个质子和 5 个中子，是铍唯一的稳定同位素。其他铍同位素的中子数不同，不能把所有铍原子的中子数都写成 5。',
    occurrence: '铍常见于绿柱石和羟硅铍石等矿物。祖母绿、海蓝宝石属于绿柱石的宝石品种，其颜色来自矿物结构和杂质等因素。',
  },
  5: {
    isotope: 11, configuration: '1s² 2s² 2p¹', shells: [2, 3], group: 13, state: '固态', melting: '2077 °C', boiling: '4000 °C',
    chemistry: '硼的最外层有 3 个电子，在许多化合物中通过共用电子形成共价键。它属于类金属，不能简单套用普通金属的性质。含硼玻璃、硼的单质与硼酸盐是不同材料。',
    isotopes: '天然硼主要由硼-10 和硼-11 组成，分别含 5 个和 6 个中子。硼-10 吸收中子的能力较强，因此可用于中子探测和相关材料。',
    occurrence: '硼常以硼酸盐形式存在于矿床中，如硼砂。硼硅酸盐玻璃利用含硼组分改善耐热等性能，玻璃并不等同于单质硼。',
  },
  6: {
    isotope: 12, configuration: '1s² 2s² 2p²', shells: [2, 4], group: 14, state: '固态', melting: '常压下升华', boiling: '约 3825 °C 升华',
    chemistry: '碳的最外层有 4 个电子，能够形成多种稳定共价结构。石墨中碳原子排列成层，金刚石中则形成坚固的空间网络；连接方式的差别使它们的硬度、导电性和外观显著不同。',
    isotopes: '碳-12 和碳-13 是稳定同位素，分别有 6 个和 7 个中子。碳-14 有 8 个中子并具有放射性，其衰变可用于年代测定。相对原子质量 12.011 不表示每个碳原子都有小数个粒子。',
    occurrence: '碳存在于天然石墨、金刚石、碳酸盐矿物和生命物质中。生物通过多种含碳化合物构建细胞，也参与地球上的碳循环。',
  },
  7: {
    isotope: 14, configuration: '1s² 2s² 2p³', shells: [2, 5], group: 15, state: '气态', melting: '−210.00 °C', boiling: '−195.80 °C',
    chemistry: '氮原子最外层有 5 个电子。普通氮气由 N₂ 分子组成，两个原子之间结合牢固，因此常温下较不活泼。但氮的化合物性质很多样，不能把氮气的性质直接套给氨或硝酸。',
    isotopes: '天然氮主要是氮-14，也含少量稳定的氮-15。二者均有 7 个质子，中子数分别为 7 和 8。',
    occurrence: '氮气约占干燥空气体积的 78%。植物和微生物参与氮循环，使氮在空气、土壤及生物体之间转移。',
  },
  8: {
    isotope: 16, configuration: '1s² 2s² 2p⁴', shells: [2, 6], group: 16, state: '气态', melting: '−218.79 °C', boiling: '−182.96 °C',
    chemistry: '氧原子最外层有 6 个电子，常温氧气主要由 O₂ 分子构成。氧能与许多物质发生氧化反应；臭氧 O₃ 则是另一种由氧元素组成的单质，性质与普通氧气不同。',
    isotopes: '氧有氧-16、氧-17 和氧-18 三种稳定同位素。它们都含 8 个质子，中子数分别为 8、9、10；自然界中氧-16 最丰富。',
    occurrence: '氧气约占干燥空气体积的 21%。氧还广泛结合在水、硅酸盐和氧化物中，是地壳中十分丰富的元素。',
  },
  9: {
    isotope: 19, configuration: '1s² 2s² 2p⁵', shells: [2, 7], group: 17, state: '气态', melting: '−219.67 °C', boiling: '−188.11 °C',
    chemistry: '氟原子最外层有 7 个电子，形成氟离子 F⁻ 后会有 10 个电子，但质子仍是 9 个。氟气 F₂ 反应性很强，含氟化合物却可能相当稳定；化学形态决定了许多具体性质。',
    isotopes: '氟-19 含 9 个质子和 10 个中子，是氟唯一的稳定同位素。卡片中的 9 个电子指中性氟原子，不是含 10 个电子的氟离子。',
    occurrence: '自然界中的氟主要结合在矿物里，如萤石，而不是大量以氟气游离存在。工业上的含氟材料使用的是不同化学形态的氟。',
  },
  10: {
    isotope: 20, configuration: '1s² 2s² 2p⁶', shells: [2, 8], group: 18, state: '气态', melting: '−248.59 °C', boiling: '−246.05 °C',
    chemistry: '氖的第二电子层有 8 个电子，形成闭壳层结构，因此通常很不活泼，并以单原子气体存在。放电时电子能级发生变化，原子发出特征光；这与把氖合成为另一种元素是两回事。',
    isotopes: '氖-20、氖-21、氖-22 都是稳定同位素，中子数分别为 10、11、12。天然氖以氖-20 为主，中性原子的电子数始终由原子序数决定。',
    occurrence: '氖在地球大气中含量很低，约为百万分之 18。工业上通常通过液化空气的分离过程获得，并用于发光及低温等领域。',
  },
  ...EXPANDED_ATOMS,
  ...EXPANDED54_ATOMS,
  55: {
    isotope: 133, configuration: '1s² 2s² 2p⁶ 3s² 3p⁶ 3d¹⁰ 4s² 4p⁶ 4d¹⁰ 5s² 5p⁶ 6s¹', shells: [2, 8, 18, 18, 8, 1], group: 1,
    state: '固态', melting: '28.5 °C', boiling: '671 °C',
    chemistry: '铯是碱金属，最外层有一个 6s 电子，化合物中常见氧化态为 +1。',
    isotopes: '铯-133 是天然稳定同位素，含 55 个质子和 78 个中子。',
    occurrence: '自然界中的铯主要以化合物形式存在，可从铯榴石等矿物中提取。',
  },
};
