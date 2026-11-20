import { ArrowRight } from 'lucide-react';
import { SCIENCE_NOTE, baikeUrl, element } from '../data/elements';
import { ARCHIVE_UNITS, MODULES, MODULE_UPGRADES, REACTORS, moduleEffect } from '../game/config';
import { DISCOVERY_STAGES } from '../game/discovery';
import { PULSE_BOOSTS } from '../game/pulseBoosts';

const chapters = [
  ['start', '开始实验'], ['numbers', '资源与速度'], ['upgrades', '选择升级'],
  ['archive', '发现与收录'], ['automation', '自动化'], ['saves', '存档与其他'],
] as const;

function CalibrationGuide() {
  return <>
    <h3 id="guide-calibration">分段校准</h3>
    <p>从钠开始，首次发现需要指定仪器达到下表的等级，并点亮对应元素的档案。升级合计是「设备扩容＋单次收益」的已购等级之和。档案累计提交 {ARCHIVE_UNITS} 份即可点亮。</p>
    <table className="tutorial-calibration" aria-labelledby="guide-calibration">
      <thead><tr><th scope="col">探索阶段</th><th scope="col">扩容至少</th><th scope="col">升级合计至少</th><th scope="col">需收录</th></tr></thead>
      <tbody>{DISCOVERY_STAGES.map(stage => {
        const sample = element(stage.specimen);
        return <tr key={stage.from}>
          <th scope="row">{element(stage.from).name}–{element(stage.to).name}
            <small>{stage.from}–{stage.to} 号 · {REACTORS[stage.reactor - 1].roman} 级</small>
          </th>
          <td>{stage.capacity} 级</td><td>{stage.tuning} 级</td><td>{sample.name} {sample.symbol}</td>
        </tr>;
      })}</tbody>
    </table>
    <p>例如要探索钪，建造 VI 级同步辐射研究环，购买 1 级设备扩容和 3 级单次收益，再收录钙。实验室的「探索」按钮旁会显示还缺哪些条件。</p>
  </>;
}

function CollisionDropsGuide() {
  return <>
    <h3>灵感点与随机掉落</h3>
    <p>发现氦后，游戏屏幕会随机掉落一个道具。点道具拾取，再去点反应容器图片。增益从拾取时开始计时，持续 1 分钟，剩余时间显示在屏幕左下角。</p>
    <dl className="tutorial-definitions">{Object.values(PULSE_BOOSTS).map(boost =>
      <div key={boost.name}><dt>{boost.name}</dt><dd>{boost.description}</dd></div>
    )}</dl>
    <p>没拾取的道具过一会儿就会消失。道具一次只生效一个，增益用于手动点击。新手引导中可以主动放出一个练习灵感点。</p>
  </>;
}

function ConstructionGuide() {
  const reactor = REACTORS[1];
  return <>
    <h3>建造第二代反应容器</h3>
    <ol>
      <li>用 I 级容器依次发现锂（Li）和铍（Be）。铍会开放「{reactor.name}」。</li>
      <li>打开「科研」，找到 II 级仪器卡。攒够 {reactor.buildCoins} 碰撞能和 {reactor.buildData} 研究数据后，点击「研发并建造」。</li>
      <li>建成后会回到实验室。用「仪器」下拉菜单切换 I 级或 II 级。处于运行状态的仪器会同时工作。</li>
    </ol>
  </>;
}

function ModuleUpgradeGuide() {
  const reaction = MODULES.reaction, upgrade = MODULE_UPGRADES.reaction[0];
  return <>
    <h3>研发和升级工业模块</h3>
    <ol>
      <li>打开「科研 → 工业自动化」。发现氦后，花 {MODULES.feed.coins} 碰撞能和 {MODULES.feed.data} 研究数据研发「原料补充」。</li>
      <li>发现铍后，在「自动反应」卡上花 {reaction.coins} 碰撞能和 {reaction.data} 研究数据，点击「研发模块」，从 1 级开始。</li>
      <li>同一张卡会显示下一级效果和费用。攒够 {upgrade.coins} 碰撞能和 {upgrade.data} 研究数据，点击「升级至 2 级」。升级后是「{moduleEffect('reaction', 2)}」。</li>
      <li>每个工业模块都可升到 3 级。可用「模块已启用／模块已暂停」切换运行状态，等级会保留。</li>
    </ol>
  </>;
}

export default function Tutorial({ onPlay }: { onPlay: () => void }) {
  return <div className="tutorial-page">
    <div className="section-heading"><div><div className="eyebrow">LABORATORY HANDBOOK</div><h1>实验室教程</h1></div><button className="secondary-button" onClick={onPlay}>返回实验<ArrowRight size={15}/></button></div>
    <div className="tutorial-layout">
      <nav className="tutorial-contents" aria-label="教程目录">{chapters.map(([id, label], i) => <a key={id} href={`#guide-${id}`}><small>0{i + 1}</small>{label}</a>)}</nav>
      <article className="tutorial-document panel" aria-label="实验室教学文档">
        <section id="guide-start"><span className="eyebrow">01 / START</span><h2>开始实验</h2><p>实验室会自动运行。本版本的目标是依次发现氢到氙（H–Xe，1–54），提交 100 氙点亮第 54 号里程碑，再补齐全部五十四格。锌、氪和钙都只是路线节点；第 55–118 号只显示为未来研究。</p><h3>第一分钟</h3><ol><li>点击高亮按钮启动仪器。</li><li>点击反应容器图片任意位置触发碰撞，即时获得碰撞能与研究数据。凑够 5 碰撞能就能购买样本。</li><li>购买一次「补充氢样本」，让实验更快。</li><li>点击「探索 He」完成引导，仪器运行 5 秒后合成第一份氦。</li><li>研发「原料补充」，之后自动为容器补样。</li><li>发现铍（Be）后建造 II 级仪器；此后 N→III、Ne→IV、Ar→V。</li><li>钙（Ca）是第 20 号历史节点，发现它开放 VI；氪（Kr）开放 VII，氙（Xe）开放可选的 VIII。</li><li>开启「自动反应」，用 I 级持续生产氢，凑够 100 份提交档案。</li></ol><h3>仪器等级</h3><p>Be、N、Ne、Ar、Ca、Kr、Xe 是仪器节点：发现它们分别开放 II、III、IV、V、VI、VII、VIII 级。VI 按相邻区间覆盖 Sc–Kr，VII 覆盖 Rb–Xe；发现只解锁路线，不等于库存，也不等于收录。</p><h3>新手引导</h3><ul><li>新存档的开局引导共四步，每次高亮一个可操作的按钮。</li><li>氦合成后，继续跟随「新手实验」拾取灵感点、建造仪器、研发及升级模块。完成后由「下一步」接手。</li><li>教程顶部的「重看新手引导」显示当前进度对应的后续建议。</li></ul><p>「下一步」可以直接完成当前推荐操作。</p><CollisionDropsGuide/></section>
        <section id="guide-numbers"><span className="eyebrow">02 / NUMBERS</span><h2>资源与速度</h2><dl className="tutorial-definitions"><div><dt>碰撞能</dt><dd>现在可以花的钱，用来升级、建设和研发。</dd></div><div><dt>收入</dt><dd>所有运行中容器每秒赚到的碰撞能。自动补样也会花钱，因此余额可能涨得更慢。</dd></div><div><dt>实验速度</dt><dd>每秒尝试几次合成，单位是「次/秒」。顶部是全实验室合计，容器控制台是当前设备。</dd></div><div><dt>速度上限</dt><dd>这台设备每秒最多做几次实验。达到上限即满负荷。</dd></div><div><dt>样本</dt><dd>提高实验速度的设备资源，不会被实验消耗。小球只是示意，数量和尺寸经过简化。</dd></div><div><dt>研究数据</dt><dd>每次实验获得 1 点，用于建造和研发；提高单次收益不会增加数据。</dd></div></dl><h3>14 次实验，为什么能赚 18.9？</h3><p>实验速度限制次数，单次收益决定每次赚多少。这两个数字的单位不同。</p><p className="tutorial-equation">14 次/秒 × 1.35 碰撞能/次<br/><strong>= 18.9 碰撞能/秒</strong></p><h3>成功率与平均等待</h3><p>每次实验都会获得碰撞能和数据，成功时才获得目标元素。平均等待是按当前速度估算的时间，实际可能更早或更晚，并非倒计时。</p><p>从钠开始，首次发现按观测进度结算，扩容能加快观测。每段的开启条件见<a href="#guide-calibration">分段校准</a>。重复生产按单次成功率结算。</p></section>
        <section id="guide-upgrades"><span className="eyebrow">03 / UPGRADES</span><h2>选择升级</h2><dl className="tutorial-definitions"><div><dt>补充氢样本</dt><dd>当前设备样本 +1，同时氢库存 +1。</dd></div><div><dt>粒子加速</dt><dd>提高实验速度；满负荷后继续加速无效。</dd></div><div><dt>单次收益</dt><dd>每次实验的碰撞能 ×1.35。满负荷后仍能增加收入。</dd></div><div><dt>设备扩容</dt><dd>II 级及以后的速度上限 ×1.18；I 级需要建造新设备来突破。</dd></div></dl><p>升级旁的一行数字是买后变化。等级是已买的级数；×10、×100 是本次购买级数，按钮金额为整批总价，余额不足时可切换到较小档位。MAX 会购买当前余额能支付的最多级数。×10、×100、MAX 只用于升级，不改变探索次数，也不消耗实验样本。</p><ConstructionGuide/><h3>买哪个才不亏</h3><ul><li>未满负荷：优先粒子加速或补样，把速度顶到上限。</li><li>已满负荷：改投单次收益或设备扩容，加速不再有效。</li><li>迟迟买不起：碰撞能或研究数据不足，先等收入积累或调整模式。</li></ul></section>
        <section id="guide-archive"><span className="eyebrow">04 / ARCHIVE</span><h2>发现与收录</h2><p>收录 100 份氖保留第一阶段里程碑；收录 100 份钙保留第 20 号里程碑；收录 100 份氙点亮第 54 号里程碑。本版终点是氙，但全收集还需要把 H–Xe 五十四格全部收录；游戏不会在钙或氪处结束。</p><div className="tutorial-journey"><span>首次合成<b>发现</b></span><i>→</i><span>重复生产<b>库存</b></span><i>→</i><span>累计提交 100<b>收录</b></span></div><h3>发现、库存、收录是三件事</h3><ul><li>发现：首次合成点亮研究路线。</li><li>库存：可以提交的产物，与设备样本分开计算，提交不扣设备样本。</li><li>收录：累计提交满 100 份，永久点亮周期表并自动激活对应元素能力。</li></ul><p>氢开局已知。提交可以分批进行。</p><CalibrationGuide/><p>例如已提交 88/100、库存 12，再提交 12 就完成收录，库存变成 0。之后仍可继续生产。</p></section>
        <section id="guide-automation"><span className="eyebrow">05 / AUTOMATION</span><h2>自动化</h2><p>在「科研」研发模块后，可以逐台设置仪器任务。</p><dl className="tutorial-definitions"><div><dt>原料补充</dt><dd>选择只给最高级仪器补样，或补充所有正在运行的仪器。自动购买共用同一个保留余额。</dd></div><div><dt>自动反应</dt><dd>批量生产已知元素。模块初始倍率为 I 级 ×8，II 级仪器起 ×32。仪器可以手动控制、探索优先、生产指定元素或生产缺档样本。</dd></div><div><dt>元素分配</dt><dd>自动提交全部已知元素，或只提交当前校准需要的样本。收满 100 份，元素能力立即生效。</dd></div></dl><h3>怎么分工</h3><p>套用「主力探索，其余补档」后，最高级仪器探索，较早的仪器负责准备样本。也可以让某一台专门生产指定元素。选择预设会重新编排所有已建仪器，逐台调整后则显示「自定义分工」。</p><p>模块可以独立暂停。临时在实验室给一台仪器选目标，会把该台切回手动控制。到了新的探索区间，仍需完成仪器调校和校准收录。</p><ModuleUpgradeGuide/><p>原料补充升级后降低自动补样成本，自动反应提高已知元素的生产倍率，元素分配在自动提交样本时返还研究数据。</p></section>
        <section id="guide-saves"><span className="eyebrow">06 / SAVES & MORE</span><h2>存档与其他</h2><p>右上角「存档与设置」可以新建、切换和删除存档。新建后从欢迎引导开始，原档的进度会保存。删除前会确认具体档位。每 12 秒自动保存当前存档，也可以导出备份。导入会替换正在使用的档位。</p><p>离线最多结算 4 小时的收入和已知元素；新元素需要在线发现。</p><h3>统计与大数</h3><p>累计数值表示历史总量，花钱或提交不会扣减；余额峰值是曾经持有的最多碰撞能。累计获得元素含合成与购买补充的氢，运行时间含已结算的离线时长。成就徽章不增加收益。</p><p>万 = 10,000，亿 = 100,000,000。科学记数法 1e6 表示 1,000,000，可在设置中切换。显示数字会取近似值，计算保留完整精度。</p><h3>科学与游戏</h3><p>本教程只描述游戏内的简化机制，不杜撰现实核反应。</p><p>{SCIENCE_NOTE}</p><p>器械与球体为游戏示意。更多元素知识可阅读 <a href={baikeUrl('化学元素')} target="_blank" rel="noreferrer">百度百科 ↗</a>。</p></section>
        <button className="primary-button" onClick={onPlay}>开始我的实验<ArrowRight size={15}/></button>
      </article>
    </div>
  </div>;
}
