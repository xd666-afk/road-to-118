import { ArrowRight } from 'lucide-react';
import { SCIENCE_NOTE, TABLE_SOURCES } from '../data/elements';

const chapters = [
  ['start', '开始实验'], ['numbers', '资源与速度'], ['upgrades', '选择升级'],
  ['archive', '发现与收录'], ['automation', '自动化'], ['saves', '存档与其他'],
] as const;

export default function Tutorial({ onPlay }: { onPlay: () => void }) {
  return <div className="tutorial-page">
    <div className="section-heading"><div><div className="eyebrow">LABORATORY HANDBOOK</div><h1>实验室教程</h1></div><button className="secondary-button" onClick={onPlay}>返回实验<ArrowRight size={15}/></button></div>
    <div className="tutorial-layout">
      <nav className="tutorial-contents" aria-label="教程目录">{chapters.map(([id, label], i) => <a key={id} href={`#guide-${id}`}><small>0{i + 1}</small>{label}</a>)}</nav>
      <article className="tutorial-document panel" aria-label="实验室教学文档">
        <section id="guide-start"><span className="eyebrow">01 / START</span><h2>开始实验</h2><p>实验室会自动运行。你的目标是依次发现氢到氖，再提交 50 单位氖，完成当前版本。</p><ol><li>购买「补充氢样本」，让实验更快。</li><li>探索下一种元素。发现铍（Be）后建造 II 型，发现氮（N）后建造 III 型。</li><li>重复生产已发现元素，把库存提交给档案，点亮周期表。</li></ol><p>「下一步」可以直接完成当前推荐操作。</p></section>
        <section id="guide-numbers"><span className="eyebrow">02 / NUMBERS</span><h2>资源与速度</h2><dl className="tutorial-definitions"><div><dt>碰撞能</dt><dd>现在可以花的钱，用来升级、建设和研发。</dd></div><div><dt>收入</dt><dd>所有运行中容器每秒赚到的碰撞能。自动补样也会花钱，因此余额可能涨得更慢。</dd></div><div><dt>实验速度</dt><dd>每秒尝试几次合成，单位是「次/秒」。顶部是全实验室合计，容器控制台是当前设备。</dd></div><div><dt>速度上限</dt><dd>这台设备每秒最多做几次实验。达到上限即满负荷。</dd></div><div><dt>样本</dt><dd>提高实验速度的设备资源，不会被实验消耗。小球只是示意，数量和尺寸经过简化。</dd></div><div><dt>研究数据</dt><dd>每次实验获得 1 点，用于建造和研发；提高单次收益不会增加数据。</dd></div></dl><h3>14 次实验，为什么能赚 18.9？</h3><p>实验速度限制次数，单次收益决定每次赚多少。这两个数字的单位不同。</p><p className="tutorial-equation">14 次/秒 × 1.35 碰撞能/次<br/><strong>= 18.9 碰撞能/秒</strong></p><h3>成功率与平均等待</h3><p>每次实验都会获得碰撞能和数据，成功时才获得目标元素。平均等待是按当前速度估算的时间，实际可能更早或更晚，并非倒计时。</p><p>例如每秒尝试 10 次、成功率 1%，平均约 10 秒获得 1 个。跨越设备推荐范围时，成功率通常更低。</p></section>
        <section id="guide-upgrades"><span className="eyebrow">03 / UPGRADES</span><h2>选择升级</h2><dl className="tutorial-definitions"><div><dt>补充氢样本</dt><dd>当前设备样本 +1，同时氢库存 +1。</dd></div><div><dt>粒子加速</dt><dd>提高实验速度；满负荷后继续加速无效。</dd></div><div><dt>单次收益</dt><dd>每次实验的碰撞能 ×1.35。满负荷后仍能增加收入。</dd></div><div><dt>设备扩容</dt><dd>II、III 型的速度上限 ×1.18；I 型需要建造新设备来突破。</dd></div></dl><p>升级旁的一行数字是买后变化。等级是已买的级数；×10、×100 是本次购买级数，按钮金额为整批总价。MAX 会购买当前余额能支付的最多级数。</p></section>
        <section id="guide-archive"><span className="eyebrow">04 / ARCHIVE</span><h2>发现与收录</h2><div className="tutorial-journey"><span>首次合成<b>发现</b></span><i>→</i><span>重复生产<b>库存</b></span><i>→</i><span>累计提交 50<b>收录</b></span></div><p>氢开局已知。其他元素首次合成后，就能研究下一种，不用先收录。收录会永久点亮周期表。</p><p>库存是可以提交的产物，与设备样本分开计算。提交会扣库存，不减少设备样本；可以分批提交。</p><p>例如已提交 38/50、库存 12，再提交 12 就完成收录，库存变成 0。之后仍可继续生产。</p></section>
        <section id="guide-automation"><span className="eyebrow">05 / AUTOMATION</span><h2>自动化</h2><p>在「科研」中研发模块，然后选择工作模式。</p><dl className="tutorial-definitions"><div><dt>原料补充</dt><dd>自动给最高级已建容器补样，满负荷时停止。</dd></div><div><dt>自动反应</dt><dd>批量生产已知元素：I 型 ×8，II、III 型 ×32。首次发现、碰撞能和数据收入不加倍。</dd></div><div><dt>元素分配</dt><dd>自动从库存分批提交，收录后保留后续产物。</dd></div></dl><h3>三种工作模式</h3><ul><li><strong>探索优先：</strong>最高级容器连续研究下一种，其他容器保留各自目标。</li><li><strong>指定生产：</strong>各容器生产选定的已知元素，关闭自动提交。</li><li><strong>收录优先：</strong>生产尚未收录的元素；研发并启用元素分配后自动提交，否则手动提交。</li></ul><p>「保留碰撞能」是自动补样至少留下的余额。手动购买仍可使用全部余额。模块可单独暂停，实验室也保留手动选目标的操作。</p></section>
        <section id="guide-saves"><span className="eyebrow">06 / SAVES & MORE</span><h2>存档与其他</h2><p>每 12 秒自动保存到当前浏览器，也可在右上角设置中导出备份。导入存档会替换当前进度。</p><p>离线最多结算 4 小时的收入和已知元素；新元素需要在线发现。</p><h3>统计与大数</h3><p>累计数值表示历史总量，花钱或提交不会扣减；余额峰值是曾经持有的最多碰撞能。累计获得元素含合成与购买补充的氢，运行时间含已结算的离线时长。成就徽章不增加收益。</p><p>万 = 10,000，亿 = 100,000,000。科学记数法 1e6 表示 1,000,000，可在设置中切换。显示数字会取近似值，计算保留完整精度。</p><h3>科学与游戏</h3><p>{SCIENCE_NOTE}</p><p>器械与球体为游戏示意，知识卡附有资料来源。元素资料参考 <a href={TABLE_SOURCES[0]} target="_blank" rel="noreferrer">IUPAC / RSC ↗</a>。</p></section>
        <button className="primary-button" onClick={onPlay}>开始我的实验<ArrowRight size={15}/></button>
      </article>
    </div>
  </div>;
}
