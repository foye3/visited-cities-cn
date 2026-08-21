"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chinaMap } from "../lib/china-map-data";
import { getCityLabel } from "../lib/city-labels";
import { findInteriorPoint } from "../lib/label-geometry.mjs";

type VisitLevel = 0 | 1 | 2 | 3 | 4 | 5;
type VisitState = Record<string, VisitLevel>;
type Point = { x: number; y: number };
type CityLabelMetric = Point & { width: number; height: number };

const VIEWBOX = { width: 800, height: 650 };
const POPOVER_WIDTH = 264;
const STORAGE_KEY = "visited-china-levels-v1";
const DESKTOP_MAX_ZOOM = 6;
const TOUCH_MAX_ZOOM = 18;
const LEVEL_CLICK_GUARD_MS = 400;
const MOUSE_DRAG_THRESHOLD_PX = 6;
const TOUCH_DRAG_THRESHOLD_PX = 10;
const MICRO_CITY_MAX_MAP_UNITS = 4;
const MICRO_CITY_MARKER_RADIUS_PX = 5;
const MICRO_CITY_HIT_RADIUS_PX = 18;
const EXPORT_SITE_ADDRESS = process.env.NEXT_PUBLIC_EXPORT_SITE_ADDRESS
  || "visited-china.foye3.chatgpt.site";

function maxZoomForCurrentDevice() {
  if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
    return TOUCH_MAX_ZOOM;
  }
  return DESKTOP_MAX_ZOOM;
}

const levels: Array<{
  value: VisitLevel;
  label: string;
  english: string;
  color: string;
}> = [
  { value: 5, label: "居住", english: "Lived", color: "#d84b3e" },
  { value: 4, label: "短居", english: "Stayed", color: "#ef8354" },
  { value: 3, label: "游玩", english: "Explored", color: "#f2bd4b" },
  { value: 2, label: "出差", english: "Business", color: "#4fa38b" },
  { value: 1, label: "路过", english: "Passed", color: "#5d83b8" },
  { value: 0, label: "没去过", english: "Not yet", color: "#d9d8d2" },
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
  const labelAnchors = useMemo(
    () => Object.fromEntries(cityNames.map((city) => [city, findInteriorPoint(chinaMap[city].path)])),
    [cityNames],
  );
  const [visits, setVisits] = useState<VisitState>({});
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [popover, setPopover] = useState<Point>({ x: 16, y: 16 });
  const [isExporting, setIsExporting] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [labelMetrics, setLabelMetrics] = useState<Record<string, CityLabelMetric>>({});
  const [mapUnitScale, setMapUnitScale] = useState(1);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [hoverPoint, setHoverPoint] = useState<Point>({ x: 0, y: 0 });

  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pathRefs = useRef<Record<string, SVGPathElement | null>>({});
  const activePointersRef = useRef<Map<number, Point>>(new Map());
  const transformRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  const levelChoiceUnlockAtRef = useRef(0);
  const lastPointerTypeRef = useRef<string | null>(null);
  const suppressMouseCityClickRef = useRef(false);
  const gestureRef = useRef<{
    primaryId: number;
    origin: Point;
    startPan: Point;
    startZoom: number;
    startDistance: number;
    startCenter: Point;
    moved: boolean;
    city: string | null;
  } | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setVisits(JSON.parse(stored) as VisitState);
    } catch {
      // A private browser session may block storage; the map still works.
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visits));
    } catch {
      // Keep the current in-memory state if storage is unavailable.
    }
  }, [storageReady, visits]);

  useEffect(() => {
    const measureMap = () => {
      if (!svgRef.current) return;
      const nextMetrics: Record<string, CityLabelMetric> = {};
      for (const city of cityNames) {
        const path = pathRefs.current[city];
        if (!path) continue;
        const bounds = path.getBBox();
        const anchor = labelAnchors[city];
        nextMetrics[city] = {
          x: anchor.x + chinaMap[city].offset.x,
          y: anchor.y + chinaMap[city].offset.y,
          width: bounds.width,
          height: bounds.height,
        };
      }
      const rect = svgRef.current.getBoundingClientRect();
      setLabelMetrics(nextMetrics);
      setMapUnitScale(Math.min(rect.width / VIEWBOX.width, rect.height / VIEWBOX.height));
    };

    const frame = requestAnimationFrame(measureMap);
    const observer = new ResizeObserver(measureMap);
    if (svgRef.current) observer.observe(svgRef.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [cityNames, labelAnchors]);

  const score = useMemo(
    () => Object.values(visits).reduce<number>((sum, level) => sum + level, 0),
    [visits],
  );
  const visitedCount = useMemo(
    () => Object.values(visits).filter((level) => level > 0).length,
    [visits],
  );

  const visibleLabels = useMemo(
    () => showLabels ? cityNames.filter((city) => Boolean(labelMetrics[city])) : [],
    [cityNames, labelMetrics, showLabels],
  );
  const microCities = useMemo(
    () => cityNames.filter((city) => {
      const metric = labelMetrics[city];
      return metric && Math.max(metric.width, metric.height) <= MICRO_CITY_MAX_MAP_UNITS;
    }),
    [cityNames, labelMetrics],
  );

  useEffect(() => {
    if (showLabels) setHoveredCity(null);
  }, [showLabels]);

  const updateHoverTooltip = useCallback((city: string, event: React.PointerEvent<SVGPathElement>) => {
    if (showLabels || event.pointerType !== "mouse" || !stageRef.current) return;
    const stage = stageRef.current.getBoundingClientRect();
    setHoveredCity(city);
    setHoverPoint({
      x: Math.max(8, Math.min(event.clientX - stage.left + 14, stage.width - 168)),
      y: Math.max(8, Math.min(event.clientY - stage.top + 14, stage.height - 42)),
    });
  }, [showLabels]);

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
      city.top + city.height / 2 - stage.top - 171,
      stage.height - 354,
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

  const applyTransform = useCallback((nextZoom: number, nextPan: Point) => {
    transformRef.current = { zoom: nextZoom, pan: nextPan };
    setZoom(nextZoom);
    setPan(nextPan);
  }, []);

  const zoomAt = useCallback((nextZoom: number, focus = { x: 400, y: 325 }) => {
    const current = transformRef.current;
    const clamped = Math.max(1, Math.min(maxZoomForCurrentDevice(), nextZoom));
    applyTransform(clamped, {
      x: focus.x - ((focus.x - current.pan.x) / current.zoom) * clamped,
      y: focus.y - ((focus.y - current.pan.y) / current.zoom) * clamped,
    });
  }, [applyTransform]);

  const resetView = useCallback(() => {
    applyTransform(1, { x: 0, y: 0 });
  }, [applyTransform]);

  const focusCity = useCallback((city: string) => {
    const path = pathRefs.current[city];
    if (!path) return;
    const bounds = path.getBBox();
    const nextZoom = maxZoomForCurrentDevice() > DESKTOP_MAX_ZOOM ? 5 : 3.1;
    const center = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
    setSelectedCity(city);
    applyTransform(nextZoom, {
      x: VIEWBOX.width / 2 - center.x * nextZoom,
      y: VIEWBOX.height / 2 - center.y * nextZoom,
    });
    setSearch(city);
    setSearchOpen(false);
  }, [applyTransform]);

  const chooseLevel = (level: VisitLevel) => {
    if (!selectedCity) return;
    if (performance.now() < levelChoiceUnlockAtRef.current) return;
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
    zoomAt(transformRef.current.zoom * factor, focus);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest("button, aside")) return;
    lastPointerTypeRef.current = event.pointerType;
    if (event.pointerType === "mouse") suppressMouseCityClickRef.current = false;
    setHoveredCity(null);
    const captureTarget = event.pointerType === "mouse"
      && target instanceof SVGElement
      && target.dataset.city
      ? target
      : event.currentTarget;
    captureTarget.setPointerCapture(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    activePointersRef.current.set(event.pointerId, point);
    const transform = transformRef.current;
    let city = (target as HTMLElement | SVGElement).dataset.city ?? null;
    if (!city && event.pointerType !== "mouse") {
      let nearestDistance = 22;
      let nearestCenterDistance = Number.POSITIVE_INFINITY;
      for (const candidate of cityNames) {
        const bounds = pathRefs.current[candidate]?.getBoundingClientRect();
        if (!bounds) continue;
        const dx = Math.max(bounds.left - event.clientX, 0, event.clientX - bounds.right);
        const dy = Math.max(bounds.top - event.clientY, 0, event.clientY - bounds.bottom);
        const distance = Math.hypot(dx, dy);
        const centerDistance = Math.hypot(
          bounds.left + bounds.width / 2 - event.clientX,
          bounds.top + bounds.height / 2 - event.clientY,
        );
        if (distance < nearestDistance || (distance === nearestDistance && centerDistance < nearestCenterDistance)) {
          nearestDistance = distance;
          nearestCenterDistance = centerDistance;
          city = candidate;
        }
      }
    }

    if (activePointersRef.current.size === 1) {
      gestureRef.current = {
        primaryId: event.pointerId,
        origin: point,
        startPan: transform.pan,
        startZoom: transform.zoom,
        startDistance: 0,
        startCenter: { x: 0, y: 0 },
        moved: false,
        city,
      };
      return;
    }

    if (activePointersRef.current.size === 2 && svgRef.current) {
      const [first, second] = Array.from(activePointersRef.current.values());
      const rect = svgRef.current.getBoundingClientRect();
      const centerClient = {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
      };
      gestureRef.current = {
        primaryId: event.pointerId,
        origin: point,
        startPan: transform.pan,
        startZoom: transform.zoom,
        startDistance: Math.hypot(second.x - first.x, second.y - first.y),
        startCenter: {
          x: ((centerClient.x - rect.left) / rect.width) * VIEWBOX.width,
          y: ((centerClient.y - rect.top) / rect.height) * VIEWBOX.height,
        },
        moved: true,
        city: null,
      };
      setSelectedCity(null);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || !activePointersRef.current.has(event.pointerId) || !svgRef.current) return;
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const rect = svgRef.current.getBoundingClientRect();

    if (activePointersRef.current.size >= 2) {
      const [first, second] = Array.from(activePointersRef.current.values());
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      if (!gesture.startDistance) return;
      const nextZoom = Math.max(1, Math.min(maxZoomForCurrentDevice(), gesture.startZoom * distance / gesture.startDistance));
      const centerClient = {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
      };
      const currentCenter = {
        x: ((centerClient.x - rect.left) / rect.width) * VIEWBOX.width,
        y: ((centerClient.y - rect.top) / rect.height) * VIEWBOX.height,
      };
      const mapPoint = {
        x: (gesture.startCenter.x - gesture.startPan.x) / gesture.startZoom,
        y: (gesture.startCenter.y - gesture.startPan.y) / gesture.startZoom,
      };
      gesture.moved = true;
      applyTransform(nextZoom, {
        x: currentCenter.x - mapPoint.x * nextZoom,
        y: currentCenter.y - mapPoint.y * nextZoom,
      });
      return;
    }

    if (gesture.primaryId !== event.pointerId) return;
    const clientDx = event.clientX - gesture.origin.x;
    const clientDy = event.clientY - gesture.origin.y;
    const dragThreshold = event.pointerType === "mouse"
      ? MOUSE_DRAG_THRESHOLD_PX
      : TOUCH_DRAG_THRESHOLD_PX;
    if (Math.hypot(clientDx, clientDy) > dragThreshold) gesture.moved = true;
    const dx = (clientDx / rect.width) * VIEWBOX.width;
    const dy = (clientDy / rect.height) * VIEWBOX.height;
    applyTransform(gesture.startZoom, {
      x: gesture.startPan.x + dx,
      y: gesture.startPan.y + dy,
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    activePointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (activePointersRef.current.size === 0) {
      suppressMouseCityClickRef.current = event.pointerType === "mouse" && Boolean(gesture?.moved);
      if (gesture && !gesture.moved && gesture.city) {
        // Mobile browsers may dispatch a synthetic click after pointerup. If the
        // newly opened menu is under the finger, that click must not choose a level.
        levelChoiceUnlockAtRef.current = performance.now() + LEVEL_CLICK_GUARD_MS;
        setSelectedCity(gesture.city);
      }
      gestureRef.current = null;
      return;
    }

    if (activePointersRef.current.size === 1) {
      const [remainingId, remainingPoint] = Array.from(activePointersRef.current.entries())[0];
      const transform = transformRef.current;
      gestureRef.current = {
        primaryId: remainingId,
        origin: remainingPoint,
        startPan: transform.pan,
        startZoom: transform.zoom,
        startDistance: 0,
        startCenter: { x: 0, y: 0 },
        moved: true,
        city: null,
      };
    }
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId);
    if (activePointersRef.current.size === 0) gestureRef.current = null;
  };

  const clearAllMarks = () => {
    if (Object.keys(visits).length === 0) return;
    if (!window.confirm("确定清除所有城市标记吗？此操作无法撤销。")) return;
    setVisits({});
    setSelectedCity(null);
    setSearch("");
    resetView();
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
      const exportLabels = showLabels
        ? cityNames
          .filter((city) => Boolean(labelMetrics[city]))
          .map((city) => {
            const metric = labelMetrics[city];
            return `<text x="${metric.x}" y="${metric.y}" text-anchor="middle" dominant-baseline="central" font-family="Arial,'Noto Sans SC',sans-serif" font-size="11" font-weight="700" fill="#242824" stroke="#fffdf8" stroke-width="2.6" paint-order="stroke">${escapeXml(getCityLabel(city))}</text>`;
          })
          .join("")
        : "";
      const legend = levels
        .map((level, index) => {
          const y = 376 + index * 92;
          return `<rect x="1300" y="${y}" width="46" height="46" rx="10" fill="${level.color}"/><text x="1370" y="${y + 20}" font-size="25" font-weight="700" fill="#252824">${level.label}</text><text x="1370" y="${y + 48}" font-size="18" fill="#74766f">${level.english} · ${level.value}分</text>`;
        })
        .join("");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="1800" height="1160" fill="#f4f0e7"/><text x="92" y="90" font-family="Arial,'Noto Sans SC',sans-serif" font-size="46" font-weight="800" fill="#20241f">我的中国足迹</text><text x="1300" y="110" font-family="Arial,'Noto Sans SC',sans-serif" font-size="24" fill="#74766f">VISITED CHINA</text><g transform="translate(70 168) scale(${mapScale})">${mapPaths}${exportLabels}</g><rect x="1258" y="168" width="470" height="824" rx="36" fill="#fffdf8" stroke="#dcd8cd" stroke-width="2"/><text x="1300" y="250" font-family="Arial,'Noto Sans SC',sans-serif" font-size="26" fill="#74766f">足迹总分</text><text x="1300" y="326" font-family="Arial,'Noto Sans SC',sans-serif" font-size="70" font-weight="800" fill="#c54034">${score}</text><text x="1470" y="320" font-family="Arial,'Noto Sans SC',sans-serif" font-size="24" fill="#74766f">${visitedCount} 座城市</text>${legend}<text x="92" y="1090" font-family="Arial,'Noto Sans SC',sans-serif" font-size="20" fill="#8d8e88">${escapeXml(EXPORT_SITE_ADDRESS)}</text></svg>`;
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
            ref={searchInputRef}
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
            role="combobox"
            aria-autocomplete="list"
            aria-controls="city-suggestions"
            aria-expanded={searchOpen && suggestions.length > 0}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")} aria-label="Clear search">
              ×
            </button>
          )}
          {searchOpen && suggestions.length > 0 && (
            <div id="city-suggestions" className="suggestions" role="listbox">
              {suggestions.map((city) => (
                <button key={city} onClick={() => focusCity(city)} role="option" aria-selected="false">
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
          onPointerDown={(event) => {
            searchInputRef.current?.blur();
            handlePointerDown(event);
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onClick={(event) => {
            if (event.currentTarget === event.target) setSelectedCity(null);
          }}
        >
          <div className="map-caption">
            <span className="eyebrow">点击一座城市开始</span>
            <h1>你在中国，留下了多少足迹？</h1>
            <p>点选城市标记足迹等级，拖动地图或双指缩放探索。</p>
          </div>

          <svg
            ref={svgRef}
            className="china-map"
            viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
            role="img"
            aria-label="Interactive map of cities in China"
            onWheel={handleWheel}
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
                    onPointerEnter={(event) => updateHoverTooltip(city, event)}
                    onPointerMove={(event) => updateHoverTooltip(city, event)}
                    onPointerLeave={() => setHoveredCity((current) => current === city ? null : current)}
                    onClick={() => {
                      if (lastPointerTypeRef.current !== "mouse") return;
                      if (suppressMouseCityClickRef.current) {
                        suppressMouseCityClickRef.current = false;
                        return;
                      }
                      levelChoiceUnlockAtRef.current = performance.now() + LEVEL_CLICK_GUARD_MS;
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
              {microCities.map((city) => {
                const metric = labelMetrics[city];
                const screenScale = Math.max(mapUnitScale * zoom, 0.01);
                return (
                  <g key={`micro-${city}`} className="micro-city-target">
                    <circle
                      className="micro-city-marker"
                      cx={metric.x}
                      cy={metric.y}
                      r={MICRO_CITY_MARKER_RADIUS_PX / screenScale}
                      strokeWidth={1.8 / screenScale}
                      aria-hidden="true"
                    />
                    <circle
                      className="micro-city-hit-area"
                      data-city={city}
                      role="button"
                      tabIndex={0}
                      aria-label={`Select ${chinaMap[city].name}`}
                      cx={metric.x}
                      cy={metric.y}
                      r={MICRO_CITY_HIT_RADIUS_PX / screenScale}
                      onClick={(event) => {
                        event.stopPropagation();
                        levelChoiceUnlockAtRef.current = performance.now() + LEVEL_CLICK_GUARD_MS;
                        setSelectedCity(city);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedCity(city);
                        }
                      }}
                    />
                  </g>
                );
              })}
              {visibleLabels.map((city) => {
                const metric = labelMetrics[city];
                return (
                  <text
                    key={`label-${city}`}
                    className="city-label"
                    data-city={city}
                    role="button"
                    tabIndex={0}
                    aria-label={`Select ${chinaMap[city].name}`}
                    x={metric.x}
                    y={metric.y}
                    fontSize={10.5 / Math.max(mapUnitScale * zoom, 0.01)}
                    strokeWidth={2.7 / Math.max(mapUnitScale * zoom, 0.01)}
                    textAnchor="middle"
                    dominantBaseline="central"
                    onClick={(event) => {
                      event.stopPropagation();
                      levelChoiceUnlockAtRef.current = performance.now() + LEVEL_CLICK_GUARD_MS;
                      setSelectedCity(city);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedCity(city);
                      }
                    }}
                  >
                    {getCityLabel(city)}
                  </text>
                );
              })}
            </g>
          </svg>

          {!showLabels && hoveredCity && (
            <div
              className="city-hover-tooltip"
              style={{ left: hoverPoint.x, top: hoverPoint.y }}
              aria-hidden="true"
            >
              {chinaMap[hoveredCity].name}
            </div>
          )}

          <button
            className={`label-toggle${showLabels ? " active" : ""}`}
            onClick={() => setShowLabels((current) => !current)}
            aria-pressed={showLabels}
          >
            城市名 <span>{showLabels ? "开" : "关"}</span>
          </button>

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
                  <span>选择足迹等级</span>
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
            <button
              className="clear-all-button"
              onClick={clearAllMarks}
              disabled={Object.keys(visits).length === 0}
            >
              清除全部标记
            </button>
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
