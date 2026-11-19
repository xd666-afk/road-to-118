/**
 * 元素能力资料表（H–Xe，1–54）。
 *
 * 纯静态数据，不读取也不修改游戏状态；百分比由宿主按渠道汇总、
 * 设置上限后自行决定如何作用于引擎。文案均为虚构实验增益，
 * 不包含任何真实可操作的化学步骤。
 */

export type AbilityChannel = 'energy' | 'data' | 'production';

export interface ElementAbility {
  name: string;
  description: string;
  channel: AbilityChannel;
  /** 虚构实验增益幅度，取值 2–5。 */
  percent: number;
}

const ABILITIES = new Map<number, ElementAbility>([
  // 扩充到 Cs–Og（55–118）时，按同一结构继续追加即可；未登记的 z 返回 undefined。
  [1, { name: '氢样本回收', channel: 'energy', percent: 3, description: '把第一束火花稳稳接住，开局的碰撞能结算更早亮起，节奏也更连贯。' }],
  [2, { name: '氦声稳态', channel: 'energy', percent: 2, description: '让气泡般的噪声退开，读数跳动变轻，能量记录更安静。' }],
  [3, { name: '锂芯蓄能', channel: 'energy', percent: 4, description: '把零散能量收进微型电芯，碰撞能的回收更从容。' }],
  [4, { name: '铍窗透视', channel: 'data', percent: 3, description: '以轻薄观察窗减少遮挡，研究数据的采样画面更清楚。' }],
  [5, { name: '硼骨缓释', channel: 'production', percent: 3, description: '为样本铺一层疏松骨架，元素产出更均匀地累积。' }],
  [6, { name: '碳架扩张', channel: 'production', percent: 4, description: '反应架搭得更稳，更多样本能同时完成转化。' }],
  [7, { name: '氮雾隔噪', channel: 'data', percent: 2, description: '一层惰性薄雾隔开杂讯，数据记录更少被打断。' }],
  [8, { name: '氧桥催化', channel: 'energy', percent: 5, description: '让能量沿链条传得更快，连续碰撞的收益明显上扬。' }],
  [9, { name: '氟纹蚀刻', channel: 'data', percent: 4, description: '在载片上刻出细密纹路，同样时间里读到更多数据细节。' }],
  [10, { name: '氖光标记', channel: 'energy', percent: 3, description: '橙红辉光标出高效路径，能量结算更顺畅。' }],
  [11, { name: '钠线导流', channel: 'energy', percent: 3, description: '以柔韧细线整理回路，碰撞能的流动更均匀。' }],
  [12, { name: '镁焰助燃', channel: 'energy', percent: 4, description: '短暂白焰点燃反应节奏，单位时间的碰撞更密集。' }],
  [13, { name: '铝甲轻盈', channel: 'production', percent: 3, description: '轻质外壳卸下运转负担，产出流程更耐久。' }],
  [14, { name: '硅基逻辑', channel: 'data', percent: 5, description: '把实验记录写进硅基底层，研究数据的解析更快。' }],
  [15, { name: '磷光索引', channel: 'data', percent: 2, description: '微弱余辉为数据加上索引，回溯实验更省力。' }],
  [16, { name: '硫链交联', channel: 'production', percent: 4, description: '柔韧链段把产线接起来，元素在工序之间衔接更顺。' }],
  [17, { name: '氯痕净化', channel: 'data', percent: 3, description: '清掉载片上的微小杂点，采样结果更干净。' }],
  [18, { name: '氩幕封装', channel: 'production', percent: 3, description: '以惰性幕布封装样本，产出途中的损耗更少。' }],
  [19, { name: '钾火跃迁', channel: 'energy', percent: 5, description: '跳跃式火花更频繁，碰撞能会出现额外增益。' }],
  [20, { name: '钙格定格', channel: 'production', percent: 4, description: '为档案加上稳定晶格，样本收录流程更顺畅。' }],
  [21, { name: '钪架轻量', channel: 'production', percent: 3, description: '更轻的支架让整条产线转得更省力。' }],
  [22, { name: '钛壁承压', channel: 'production', percent: 4, description: '坚固腔壁延长高压阶段，产出过程更少中断。' }],
  [23, { name: '钒桥恒流', channel: 'data', percent: 3, description: '稳流桥让采样脉冲平稳，数据波动更小。' }],
  [24, { name: '铬面反照', channel: 'energy', percent: 3, description: '镜面把散失的火花折返，能量回收略有提升。' }],
  [25, { name: '锰脉调度', channel: 'energy', percent: 4, description: '错开反应峰值后，同样时长能跑出更多碰撞。' }],
  [26, { name: '铁轨磁送', channel: 'production', percent: 4, description: '磁轨把样本稳稳送过产线，工序衔接更紧凑。' }],
  [27, { name: '钴蓝显影', channel: 'data', percent: 3, description: '蓝色显影让弱信号现形，数据采集更完整。' }],
  [28, { name: '镍网耐蚀', channel: 'production', percent: 4, description: '耐蚀网兜住细碎产物，逸散造成的损失更少。' }],
  [29, { name: '铜脉导流', channel: 'energy', percent: 5, description: '高导铜脉贯通回路，碰撞能结算更快更稳。' }],
  [30, { name: '锌层护板', channel: 'production', percent: 3, description: '薄镀层护住产线，长时间运行更少停顿。' }],
  [31, { name: '镓掌低温', channel: 'data', percent: 4, description: '低温掌托稳住传感元件，数据读取更精准。' }],
  [32, { name: '锗镜聚热', channel: 'data', percent: 4, description: '红外透镜捕捉微弱热迹，数据样本更丰富。' }],
  [33, { name: '砷格调谐', channel: 'data', percent: 3, description: '调准晶格节拍，让读数在噪声里保持清晰。' }],
  [34, { name: '硒膜感光', channel: 'energy', percent: 3, description: '感光薄膜把光脉冲转成能量，碰撞收益更亮。' }],
  [35, { name: '溴影显色', channel: 'data', percent: 3, description: '显色微影留下清楚痕迹，数据归档更省时。' }],
  [36, { name: '氪灯远照', channel: 'energy', percent: 4, description: '远光灯标照亮长产线，能量路径更少迷失。' }],
  [37, { name: '铷钟校拍', channel: 'data', percent: 5, description: '以原子节拍校时，数据采样间隔更精准。' }],
  [38, { name: '锶焰标定', channel: 'energy', percent: 3, description: '焰色标出反应阶段，能量峰值更容易被捕获。' }],
  [39, { name: '钇格恒温', channel: 'production', percent: 3, description: '恒温格架稳住工序，产线节拍更连贯。' }],
  [40, { name: '锆壁耐热', channel: 'production', percent: 5, description: '耐热外壁扛住长时运转，产出更持续。' }],
  [41, { name: '铌腔超导', channel: 'energy', percent: 5, description: '低温腔体几乎不留阻力，碰撞能损耗更少。' }],
  [42, { name: '钼骨固结', channel: 'production', percent: 4, description: '高温下仍稳固的骨架，让产线少停一次。' }],
  [43, { name: '锝迹示踪', channel: 'data', percent: 4, description: '微量示踪标出流程节点，数据盲区更少。' }],
  [44, { name: '钌触催化', channel: 'production', percent: 5, description: '接触面加速转化，单位样本得到更多产出。' }],
  [45, { name: '铑镜聚光', channel: 'energy', percent: 3, description: '聚光镜把散光收回，能量读数更集中。' }],
  [46, { name: '钯膜筛纯', channel: 'data', percent: 4, description: '筛膜滤去杂讯，研究数据的纯度更高。' }],
  [47, { name: '银线疾传', channel: 'energy', percent: 4, description: '银线把脉冲送到每个角落，能量调度更快。' }],
  [48, { name: '镉板吸光', channel: 'data', percent: 3, description: '吸光薄板压低背景眩光，数据更易辨认。' }],
  [49, { name: '铟膜贴合', channel: 'production', percent: 3, description: '柔性贴合让传感片适应曲面，产出流程更顺。' }],
  [50, { name: '锡焊续接', channel: 'production', percent: 4, description: '可靠焊点接起断开的产线，产出更少漏接。' }],
  [51, { name: '锑晶阻尼', channel: 'data', percent: 2, description: '阻尼晶格吸收震动，数据记录更平静。' }],
  [52, { name: '碲层感光', channel: 'data', percent: 4, description: '感光薄层拓宽采集范围，数据积累更快。' }],
  [53, { name: '碘雾留痕', channel: 'data', percent: 3, description: '碘雾留下阶段标记，实验回溯更清楚。' }],
  [54, { name: '氙闪远光', channel: 'energy', percent: 5, description: '高压氙闪穿透长夜，为整条产线带来最后一束强光。' }],
]);

/** 返回对应元素的能力；未定义（如尚未扩充到该元素）时返回 undefined。 */
export function getElementAbility(z: number): ElementAbility | undefined {
  return ABILITIES.get(z);
}
