"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chinaMap } from "../lib/china-map-data";

type VisitLevel = 0 | 1 | 2 | 3 | 4 | 5;
type VisitState = Record<string, VisitLevel>;
type Point = { x: number; y: number };

const VIEWBOX = { width: 800, height: 650 };
const POPOVER_WIDTH = 264;
const STORAGE_KEY = "visited-china-levels-v1";

const levels: Array<{
  value: VisitLevel;
  label: string;
  english: string;
  color: string;
}> = [
  { value: 5, label: "居住过", english: "Lived", color: "#d84b3e" },
  { value: 4, label: "短居", english: "Stayed", color: "#ef8354" },
  { value: 3, label: "深度游玩", english: "Explored", color: "#f2bd4b" },
  { value: 2, label: "到访", english: "Visited", color: "#4fa38b" },
  { value: 1, label: "路过", english: "Passed", color: "#5d83b8" },
  { value: 0, label: "未去过", english: "Not yet", color: "#d9d8d2" },
];

const colorByLevel = Object.fromEntries(
  levels.map((level) => [level.value, level.color]),
) as Record<VisitLevel, string>;

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 19h14" />
    </svg>
  );
}

function LocateIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
    </svg>
  );
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character];
  });
}

export default function Home() {
  const cityNames = useMemo(() => Object.keys(chinaMap), []);
  const [visits, setVisits] = useState<VisitState>({});
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [popover, setPopover] = useState<Point>({ x: 16, y: 16 });
  const [isExporting, setIsExporting] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef<Record<string, SVGPathElement | null>>({});
  const pointerRef = useRef<{
    id: number;
    origin: Point;
    pan: Point;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setVisits(JSON.parse(stored) as VisitState);
    } catch {
      // A private browser session may block storage; the map still works.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visits));
    } catch {
      // Keep the current in-memory state if storage is unavailable.
    }
  }, [visits]);

  const score = useMemo(
    () => Object.values(visits).reduce<number>((sum, level) => sum + level, 0),
    [visits],
  );
  const visitedCount = useMemo(
    () => Object.values(visits).filter((level) => level > 0).length,
    [visits],
  );

  const suggestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return cityNames
      .filter((city) => {
        const fullName = chinaMap[city].name;
        return city.toLowerCase().includes(query) || fullName.toLowerCase().includes(query);
      })
      .sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(query) ? 0 : 1;
        const bStarts = b.toLowerCase().startsWith(query) ? 0 : 1;
        return aStarts - bStarts || a.localeCompare(b, "zh-CN");
      })
      .slice(0, 8);
  }, [cityNames, search]);

  const updatePopover = useCallback(() => {
    if (!selectedCity || !stageRef.current || !pathRefs.current[selectedCity]) return;
    const stage = stageRef.current.getBoundingClientRect();
    const city = pathRefs.current[selectedCity]!.getBoundingClientRect();
    const gap = 14;
    let x = city.right - stage.left + gap;
    if (x + POPOVER_WIDTH > stage.width - 12) {
      x = city.left - stage.left - POPOVER_WIDTH - gap;
    }
    x = Math.max(12, Math.min(x, stage.width - POPOVER_WIDTH - 12));
    const y = Math.max(12, Math.min(
      city.top + city.height / 2 - stage.top - 156,
      stage.height - 324,
    ));
    setPopover({ x, y });
  }, [selectedCity]);

  useEffect(() => {
    const frame = requestAnimationFrame(updatePopover);
    window.addEventListener("resize", updatePopover);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePopover);
    };
  }, [pan, selectedCity, updatePopover, zoom]);

  const zoomAt = useCallback((nextZoom: number, focus = { x: 400, y: 325 }) => {
    setZoom((currentZoom) => {
      const clamped = Math.max(1, Math.min(5, nextZoom));
      setPan((currentPan) => ({
        x: focus.x - ((focus.x - currentPan.x) / currentZoom) * clamped,
        y: focus.y - ((focus.y - currentPan.y) / currentZoom) * clamped,
      }));
      return clamped;
    });
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const focusCity = useCallback((city: string) => {
    const path = pathRefs.current[city];
    if (!path) return;
    const bounds = path.getBBox();
    const nextZoom = 3.1;
    const center = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
    setSelectedCity(city);
    setZoom(nextZoom);
    setPan({
      x: VIEWBOX.width / 2 - center.x * nextZoom,
      y: VIEWBOX.height / 2 - center.y * nextZoom,
    });
    setSearch(city);
    setSearchOpen(false);
  }, []);

  const chooseLevel = (level: VisitLevel) => {
    if (!selectedCity) return;
    setVisits((current) => ({ ...current, [selectedCity]: level }));
    setSelectedCity(null);
  };

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const focus = {
      x: ((event.clientX - rect.left) / rect.width) * VIEWBOX.width,
      y: ((event.clientY - rect.top) / rect.height) * VIEWBOX.height,
    };
    const factor = event.deltaY > 0 ? 0.86 : 1.16;
    zoomAt(zoom * factor, focus);
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = {
      id: event.pointerId,
      origin: { x: event.clientX, y: event.clientY },
      pan,
      moved: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = ((event.clientX - pointer.origin.x) / rect.width) * VIEWBOX.width;
    const dy = ((event.clientY - pointer.origin.y) / rect.height) * VIEWBOX.height;
    if (Math.abs(dx) + Math.abs(dy) > 3) pointer.moved = true;
    setPan({ x: pointer.pan.x + dx, y: pointer.pan.y + dy });
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (pointerRef.current?.id === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      window.setTimeout(() => {
        pointerRef.current = null;
      }, 0);
    }
  };

  const exportMap = async () => {
    setIsExporting(true);
    try {
      const width = 1800;
      const height = 1160;
      const mapScale = 1.34;
      const mapPaths = cityNames
        .map((city) => {
          const level = visits[city] ?? 0;
          return `<path d="${escapeXml(chinaMap[city].path)}" fill="${colorByLevel[level]}" stroke="#fffdf8" stroke-width="0.7" stroke-linejoin="round"/>`;
        })
        .join("");
      const legend = levels
        .map((level, index) => {
          const y = 376 + index * 92;
          return `<rect x="1300" y="${y}" width="46" height="46" rx="10" fill="${level.color}"/><text x="1370" y="${y + 20}" font-size="25" font-weight="700" fill="#252824">${level.label}</text><text x="1370" y="${y + 48}" font-size="18" fill="#74766f">${level.english} · ${level.value}分</text>`;
        })
        .join("");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="1800" height="1160" fill="#f4f0e7"/><text x="92" y="90" font-family="Arial,'Noto Sans SC',sans-serif" font-size="46" font-weight="800" fill="#20241f">我的中国足迹</text><text x="1300" y="110" font-family="Arial,'Noto Sans SC',sans-serif" font-size="24" fill="#74766f">VISITED CHINA</text><g transform="translate(70 168) scale(${mapScale})">${mapPaths}</g><rect x="1258" y="168" width="470" height="824" rx="36" fill="#fffdf8" stroke="#dcd8cd" stroke-width="2"/><text x="1300" y="250" font-family="Arial,'Noto Sans SC',sans-serif" font-size="26" fill="#74766f">足迹总分</text><text x="1300" y="326" font-family="Arial,'Noto Sans SC',sans-serif" font-size="70" font-weight="800" fill="#c54034">${score}</text><text x="1470" y="320" font-family="Arial,'Noto Sans SC',sans-serif" font-size="24" fill="#74766f">${visitedCount} 座城市</text>${legend}<text x="92" y="1090" font-family="Arial,'Noto Sans SC',sans-serif" font-size="20" fill="#8d8e88">生成于 Visited China · 完整地图视图</text></svg>`;
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Could not render the map"));
        image.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      context.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!png) throw new Error("Could not create the image");
      const downloadUrl = URL.createObjectURL(png);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = "visited-china-map.png";
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Visited China home">
          <span className="brand-mark">中</span>
          <span>
            <strong>我的中国足迹</strong>
            <small>VISITED CHINA</small>
          </span>
        </a>

        <div className="search-wrap">
          <SearchIcon />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && suggestions[0]) focusCity(suggestions[0]);
              if (event.key === "Escape") setSearchOpen(false);
            }}
            placeholder="搜索城市，例如：成都"
            aria-label="Search a city"
            aria-expanded={searchOpen && suggestions.length > 0}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")} aria-label="Clear search">
              ×
            </button>
          )}
          {searchOpen && suggestions.length > 0 && (
            <div className="suggestions" role="listbox">
              {suggestions.map((city) => (
                <button key={city} onClick={() => focusCity(city)} role="option">
                  <span>{city}</span>
                  <small>{chinaMap[city].name}</small>
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="export-button" onClick={exportMap} disabled={isExporting}>
          <DownloadIcon />
          <span>{isExporting ? "正在生成…" : "保存完整地图"}</span>
        </button>
      </header>

      <section className="workspace">
        <div
          className="map-stage"
          ref={stageRef}
          onClick={(event) => {
            if (event.currentTarget === event.target) setSelectedCity(null);
          }}
        >
          <div className="map-caption">
            <span className="eyebrow">点击一座城市开始</span>
            <h1>你在中国，留下了多少足迹？</h1>
            <p>点选城市标记到访程度，滚轮或按钮可缩放，拖动地图探索。</p>
          </div>

          <svg
            ref={svgRef}
            className="china-map"
            viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
            role="img"
            aria-label="Interactive map of cities in China"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
              {cityNames.map((city) => {
                const level = visits[city] ?? 0;
                const selected = selectedCity === city;
                return (
                  <path
                    key={city}
                    ref={(element) => {
                      pathRefs.current[city] = element;
                    }}
                    data-city={city}
                    d={chinaMap[city].path}
                    fill={colorByLevel[level]}
                    className={`city-path${selected ? " is-selected" : ""}`}
                    vectorEffect="non-scaling-stroke"
                    tabIndex={0}
                    aria-label={`${chinaMap[city].name}, ${levels.find((item) => item.value === level)?.label}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (pointerRef.current?.moved) return;
                      setSelectedCity(city);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedCity(city);
                      }
                    }}
                  />
                );
              })}
            </g>
          </svg>

          <div className="zoom-controls" aria-label="Map zoom controls">
            <button onClick={() => zoomAt(zoom * 1.3)} aria-label="Zoom in">+</button>
            <button onClick={() => zoomAt(zoom / 1.3)} aria-label="Zoom out">−</button>
            <button onClick={resetView} aria-label="Reset map view" className="locate-button">
              <LocateIcon />
            </button>
          </div>

          <div className="zoom-readout">{Math.round(zoom * 100)}%</div>

          {selectedCity && (
            <aside
              className="city-popover"
              style={{ left: popover.x, top: popover.y }}
              aria-label={`Set visit level for ${selectedCity}`}
            >
              <div className="popover-heading">
                <div>
                  <span>选择到访程度</span>
                  <h2>{chinaMap[selectedCity].name}</h2>
                </div>
                <button onClick={() => setSelectedCity(null)} aria-label="Close">×</button>
              </div>
              <div className="level-options">
                {levels.map((level) => (
                  <button
                    key={level.value}
                    className={(visits[selectedCity] ?? 0) === level.value ? "active" : ""}
                    onClick={() => chooseLevel(level.value)}
                  >
                    <span className="level-dot" style={{ background: level.color }} />
                    <span className="level-copy">
                      <strong>{level.label}</strong>
                      <small>{level.english}</small>
                    </span>
                    <span className="level-score">+{level.value}</span>
                  </button>
                ))}
              </div>
            </aside>
          )}
        </div>

        <aside className="side-panel">
          <section className="score-card">
            <span className="eyebrow">YOUR FOOTPRINT</span>
            <div className="score-row">
              <strong>{score}</strong>
              <span>分</span>
            </div>
            <p>已标记 <b>{visitedCount}</b> / {cityNames.length} 座城市</p>
            <div className="score-track">
              <span style={{ width: `${Math.min(100, (visitedCount / cityNames.length) * 100)}%` }} />
            </div>
          </section>

          <section className="legend-card">
            <div className="section-heading">
              <h2>足迹图例</h2>
              <span>每座城市计分</span>
            </div>
            <div className="legend-list">
              {levels.map((level) => (
                <div className="legend-item" key={level.value}>
                  <span className="legend-swatch" style={{ background: level.color }} />
                  <span>
                    <strong>{level.label}</strong>
                    <small>{level.english}</small>
                  </span>
                  <b>{level.value}</b>
                </div>
              ))}
            </div>
          </section>

          <p className="privacy-note">你的标记仅保存在当前设备。导出的图片始终包含完整地图与图例，不受当前缩放影响。</p>
        </aside>
      </section>
    </main>
  );
}
