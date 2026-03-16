import { useState, useMemo } from 'react';

// ==================== 物理常量 ====================
const g = 9.8;        // 重力加速度 (m/s²)
const R = 50.0;       // 桥梁半径 (m)
const m = 1.0;        // 汽车质量 (kg)
const V_CRIT = Math.sqrt(g * R); // 临界速度 ≈ 22.14 m/s

// ==================== SVG 画布配置 ====================
const SVG_W = 600;
const SVG_H = 420;
const MARGIN = { left: 55, right: 15, top: 20, bottom: 45 };
const PLOT_W = SVG_W - MARGIN.left - MARGIN.right;
const PLOT_H = SVG_H - MARGIN.top - MARGIN.bottom;

// 两种模型的视图参数
const VIEW_CONFIG = {
  convex: {
    physXRange: [-45, 45],   // 物理坐标x范围 (m)
    physYRange: [-15, 35],   // 物理坐标y范围 (m)
    gridXStep: 10,
    gridYStep: 10,
    forceScale: 8,           // 力箭头缩放：像素/牛顿
  },
  concave: {
    physXRange: [-45, 45],
    physYRange: [-20, 35],
    gridXStep: 10,
    gridYStep: 10,
    forceScale: 3,
  },
};

// ==================== 坐标映射 ====================
// 创建物理坐标到SVG坐标的映射器（等比缩放，保持圆弧不变形）
function createMapper(type) {
  const config = VIEW_CONFIG[type];
  const { physXRange, physYRange } = config;
  const physW = physXRange[1] - physXRange[0];
  const physH = physYRange[1] - physYRange[0];
  // 取较小的缩放比以保持等比
  const scale = Math.min(PLOT_W / physW, PLOT_H / physH);
  const usedW = physW * scale;
  const usedH = physH * scale;
  // 居中偏移
  const offsetX = MARGIN.left + (PLOT_W - usedW) / 2;
  const offsetY = MARGIN.top + (PLOT_H - usedH) / 2;

  return {
    scale,
    // 物理坐标 → SVG坐标（y轴翻转）
    toSVG: (px, py) => [
      offsetX + (px - physXRange[0]) * scale,
      offsetY + (physYRange[1] - py) * scale,
    ],
    fromPhysX: (px) => offsetX + (px - physXRange[0]) * scale,
    fromPhysY: (py) => offsetY + (physYRange[1] - py) * scale,
  };
}

// ==================== 桥面弧线生成 ====================
function generateBridgeArc(type) {
  const points = [];
  const n = 100;
  for (let i = 0; i <= n; i++) {
    const theta = Math.PI / 4 + (i / n) * (Math.PI / 2);
    const px = R * Math.cos(theta);
    let py;
    if (type === 'convex') {
      // 凸桥：向上拱起，最高点在θ=π/2
      py = R * Math.sin(theta) - R * Math.sin(Math.PI / 4);
    } else {
      // 凹桥：向下凹陷（碗形），最低点在θ=π/2
      py = -R * Math.sin(theta) + R + R * Math.sin(Math.PI / 4) - 35;
    }
    points.push([px, py]);
  }
  return points;
}

// 汽车在桥面极值点的物理坐标
function getCarPhysPosition(type) {
  if (type === 'convex') {
    // 凸桥最高点 θ=π/2
    return [0, R - R * Math.sin(Math.PI / 4)]; // ≈ [0, 14.64]
  } else {
    // 凹桥最低点 θ=π/2
    return [0, -R + R + R * Math.sin(Math.PI / 4) - 35]; // ≈ [0, 0.36]
  }
}

// ==================== SVG 受力分析图组件 ====================
function BridgeDiagram({ type, fn }) {
  const config = VIEW_CONFIG[type];
  const mapper = useMemo(() => createMapper(type), [type]);
  const bridgePoints = useMemo(() => generateBridgeArc(type), [type]);
  const [carPX, carPY] = useMemo(() => getCarPhysPosition(type), [type]);

  // 桥面SVG路径
  const svgBridgePoints = bridgePoints.map(([px, py]) => mapper.toSVG(px, py));
  const pathD = svgBridgePoints
    .map(([sx, sy], i) => `${i === 0 ? 'M' : 'L'}${sx.toFixed(1)},${sy.toFixed(1)}`)
    .join(' ');

  // 汽车SVG位置
  const [carSX, carSY] = mapper.toSVG(carPX, carPY);

  // 力箭头长度（像素）
  const gravityArrowLen = m * g * config.forceScale;
  const fnArrowLen = fn * config.forceScale;

  // 箭头起始偏移（避免与汽车圆点重叠）
  const arrowOffset = 12;

  // 网格线坐标
  const { physXRange, physYRange, gridXStep, gridYStep } = config;
  const gridXValues = [];
  for (let x = Math.ceil(physXRange[0] / gridXStep) * gridXStep; x <= physXRange[1]; x += gridXStep) {
    gridXValues.push(x);
  }
  const gridYValues = [];
  for (let y = Math.ceil(physYRange[0] / gridYStep) * gridYStep; y <= physYRange[1]; y += gridYStep) {
    gridYValues.push(y);
  }

  // 绘图区域边界
  const plotLeft = mapper.fromPhysX(physXRange[0]);
  const plotRight = mapper.fromPhysX(physXRange[1]);
  const plotTop = mapper.fromPhysY(physYRange[1]);
  const plotBottom = mapper.fromPhysY(physYRange[0]);

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full max-w-2xl mx-auto"
      style={{ background: '#fafafa' }}
    >
      <defs>
        {/* 蓝色箭头（重力） */}
        <marker id="arrow-blue" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#3B82F6" />
        </marker>
        {/* 橙色箭头（支持力） */}
        <marker id="arrow-orange" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#F97316" />
        </marker>
      </defs>

      {/* 绘图区域背景 */}
      <rect
        x={plotLeft} y={plotTop}
        width={plotRight - plotLeft} height={plotBottom - plotTop}
        fill="#f8fafc" stroke="#d1d5db" strokeWidth="1"
      />

      {/* 网格线 */}
      {gridXValues.map((x) => {
        const sx = mapper.fromPhysX(x);
        return (
          <line
            key={`gx${x}`}
            x1={sx} y1={plotTop} x2={sx} y2={plotBottom}
            stroke="#e5e7eb" strokeWidth="0.8"
          />
        );
      })}
      {gridYValues.map((y) => {
        const sy = mapper.fromPhysY(y);
        return (
          <line
            key={`gy${y}`}
            x1={plotLeft} y1={sy} x2={plotRight} y2={sy}
            stroke="#e5e7eb" strokeWidth="0.8"
          />
        );
      })}

      {/* 坐标轴 */}
      <line
        x1={plotLeft} y1={mapper.fromPhysY(0)} x2={plotRight} y2={mapper.fromPhysY(0)}
        stroke="#9ca3af" strokeWidth="1.5"
      />
      <line
        x1={mapper.fromPhysX(0)} y1={plotTop} x2={mapper.fromPhysX(0)} y2={plotBottom}
        stroke="#9ca3af" strokeWidth="1.5"
      />

      {/* x轴刻度标签 */}
      {gridXValues.map((x) => (
        <text
          key={`lx${x}`}
          x={mapper.fromPhysX(x)} y={plotBottom + 16}
          textAnchor="middle" fontSize="11" fill="#6b7280"
        >
          {x}
        </text>
      ))}

      {/* y轴刻度标签 */}
      {gridYValues.map((y) => (
        <text
          key={`ly${y}`}
          x={plotLeft - 8} y={mapper.fromPhysY(y) + 4}
          textAnchor="end" fontSize="11" fill="#6b7280"
        >
          {y}
        </text>
      ))}

      {/* 轴标题 */}
      <text
        x={(plotLeft + plotRight) / 2} y={SVG_H - 5}
        textAnchor="middle" fontSize="13" fill="#374151"
      >
        水平位移 (m)
      </text>
      <text
        x={13} y={(plotTop + plotBottom) / 2}
        textAnchor="middle" fontSize="13" fill="#374151"
        transform={`rotate(-90, 13, ${(plotTop + plotBottom) / 2})`}
      >
        高度 (m)
      </text>

      {/* 桥面弧线 */}
      <path d={pathD} fill="none" stroke="#555555" strokeWidth="3" strokeLinecap="round" />

      {/* 重力箭头（蓝色，向下） */}
      <line
        x1={carSX} y1={carSY + arrowOffset}
        x2={carSX} y2={carSY + arrowOffset + gravityArrowLen}
        stroke="#3B82F6" strokeWidth="3" markerEnd="url(#arrow-blue)"
      />
      {/* 重力标签 */}
      <text
        x={carSX + 14} y={carSY + arrowOffset + gravityArrowLen / 2 + 5}
        fontSize="14" fill="#3B82F6" fontWeight="bold"
      >
        mg = {(m * g).toFixed(1)}N
      </text>

      {/* 支持力箭头（橙色，向上） */}
      {fn > 0.05 && (
        <>
          <line
            x1={carSX} y1={carSY - arrowOffset}
            x2={carSX} y2={carSY - arrowOffset - fnArrowLen}
            stroke="#F97316" strokeWidth="3" markerEnd="url(#arrow-orange)"
          />
          {/* 支持力标签 */}
          <text
            x={carSX - 14} y={carSY - arrowOffset - fnArrowLen / 2 + 5}
            fontSize="14" fill="#F97316" fontWeight="bold" textAnchor="end"
          >
            Fn = {fn.toFixed(2)}N
          </text>
        </>
      )}

      {/* 汽车（红色圆点） */}
      <circle cx={carSX} cy={carSY} r={8} fill="#EF4444" stroke="#B91C1C" strokeWidth="1.5" />
    </svg>
  );
}

// ==================== 主组件 ====================
export default function App() {
  const [activeTab, setActiveTab] = useState('convex');
  const [convexSpeed, setConvexSpeed] = useState(10);
  const [concaveSpeed, setConcaveSpeed] = useState(10);

  const isConvex = activeTab === 'convex';
  const speed = isConvex ? convexSpeed : concaveSpeed;

  // 实时物理计算
  const ac = (speed * speed) / R;
  const fn = isConvex
    ? Math.max(0, m * (g - (speed * speed) / R))
    : m * (g + (speed * speed) / R);
  const isFlying = isConvex && speed >= V_CRIT;
  const overweightRatio = fn / (m * g);

  const handleSpeedChange = (e) => {
    const val = parseFloat(e.target.value);
    if (isConvex) setConvexSpeed(val);
    else setConcaveSpeed(val);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-4xl mx-auto">
        {/* 标题 */}
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
          高中物理 AI 辅助教学：圆周运动
        </h1>

        {/* 标签页切换 */}
        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={() => setActiveTab('convex')}
            className={`px-6 py-3 rounded-lg font-semibold text-lg transition-all ${
              isConvex
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            凸桥模型（拱桥）
          </button>
          <button
            onClick={() => setActiveTab('concave')}
            className={`px-6 py-3 rounded-lg font-semibold text-lg transition-all ${
              !isConvex
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            凹桥模型
          </button>
        </div>

        {/* SVG 受力分析图 */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-center text-xl font-semibold text-gray-700 mb-4">
            {isConvex ? '凸桥（拱桥）' : '凹桥'}模型 · 当前速度 v = {speed.toFixed(1)} m/s
          </h2>
          <div className="flex justify-center">
            <BridgeDiagram type={activeTab} fn={fn} />
          </div>
        </div>

        {/* 速度滑块 */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center gap-4 mb-3">
            <label className="text-lg font-semibold text-gray-700 whitespace-nowrap">
              速度调节
            </label>
            <span className="text-2xl font-bold text-blue-600">
              {speed.toFixed(1)} m/s
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={isConvex ? 35 : 50}
            step={isConvex ? 0.5 : 1}
            value={speed}
            onChange={handleSpeedChange}
            className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-sm text-gray-400 mt-1">
            <span>0 m/s</span>
            <span>{isConvex ? 35 : 50} m/s</span>
          </div>
        </div>

        {/* 实时物理参数表格 */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h3 className="text-xl font-semibold text-gray-700 mb-4 text-center">
            实时物理参数分析
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full max-w-lg mx-auto border-collapse text-lg">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left">参数名称</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">数值</th>
                  <th className="border border-gray-300 px-4 py-2 text-center">单位</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">行驶速度 v</td>
                  <td className="border border-gray-300 px-4 py-2 text-right font-mono">
                    {speed.toFixed(1)}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-center">m/s</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">
                    向心加速度 a<sub>c</sub>
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-right font-mono">
                    {ac.toFixed(2)}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-center">m/s²</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-4 py-2">
                    桥面支持力 F<sub>N</sub>
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-right font-mono">
                    {fn.toFixed(2)}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-center">N</td>
                </tr>
                {isConvex ? (
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">当前状态</td>
                    <td
                      className={`border border-gray-300 px-4 py-2 text-right font-bold ${
                        isFlying ? 'text-red-600' : 'text-green-600'
                      }`}
                      colSpan={2}
                    >
                      {isFlying ? '飞车状态（完全失重）' : '正常行驶'}
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">
                      超重倍数 F<sub>N</sub>/mg
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right font-mono font-bold">
                      {overweightRatio.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">倍</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500 mt-4 text-center">
            {isConvex
              ? `* 临界安全速度 v_max = √(gR) ≈ ${V_CRIT.toFixed(2)} m/s`
              : '* 注意：凹桥底部是容易发生爆胎或结构损坏的危险区域。'}
          </p>
        </div>

        {/* 物理公式推导 */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-xl font-semibold text-gray-700 mb-4 text-center">
            物理公式推导
          </h3>
          {isConvex ? (
            <div className="space-y-3 text-lg text-gray-700 max-w-lg mx-auto">
              <p className="font-semibold">凸桥最高点受力分析（向心方向：向下）</p>
              <p>在凸桥最高点，汽车做圆周运动，合力提供向心力：</p>
              <p className="text-center font-mono bg-gray-50 p-3 rounded text-xl">
                mg - F<sub>N</sub> = mv²/R
              </p>
              <p>解出支持力：</p>
              <p className="text-center font-mono bg-gray-50 p-3 rounded text-xl">
                F<sub>N</sub> = m(g - v²/R)
              </p>
              <p className="font-semibold mt-4">临界条件（完全失重）：</p>
              <p>
                当 F<sub>N</sub> = 0 时，v<sub>max</sub> = √(gR) ≈ {V_CRIT.toFixed(2)} m/s
              </p>
              <p>超过此速度，汽车将脱离桥面（飞车）</p>
            </div>
          ) : (
            <div className="space-y-3 text-lg text-gray-700 max-w-lg mx-auto">
              <p className="font-semibold">凹桥最低点受力分析（向心方向：向上）</p>
              <p>在凹桥最低点，汽车做圆周运动，合力提供向心力：</p>
              <p className="text-center font-mono bg-gray-50 p-3 rounded text-xl">
                F<sub>N</sub> - mg = mv²/R
              </p>
              <p>解出支持力：</p>
              <p className="text-center font-mono bg-gray-50 p-3 rounded text-xl">
                F<sub>N</sub> = m(g + v²/R)
              </p>
              <p className="font-semibold mt-4">超重分析：</p>
              <p>
                支持力始终大于重力（F<sub>N</sub> &gt; mg），汽车处于超重状态
              </p>
              <p>
                超重倍数 = F<sub>N</sub>/mg = 1 + v²/(gR)，随速度增大而增大
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
