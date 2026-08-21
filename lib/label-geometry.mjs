/**
 * Parse the simple absolute SVG paths used by china-map-data into polygon rings.
 * The source data contains M/L-style coordinate pairs and Z closures only.
 */
export function parsePathRings(path) {
  const tokens = path.match(/[MLZ]|-?\d+(?:\.\d+)?/g) ?? [];
  const rings = [];
  let ring = [];
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index++];
    if (token === "M" || token === "L") {
      if (token === "M" && ring.length) {
        rings.push(ring);
        ring = [];
      }
      ring.push({ x: Number(tokens[index++]), y: Number(tokens[index++]) });
    } else if (token === "Z") {
      if (ring.length) rings.push(ring);
      ring = [];
    } else {
      // SVG permits coordinate pairs after M without repeating L.
      ring.push({ x: Number(token), y: Number(tokens[index++]) });
    }
  }

  if (ring.length) rings.push(ring);
  return rings;
}

export function pointInRing(point, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const a = ring[index];
    const b = ring[previous];
    if (
      (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function distanceToSegment(point, a, b) {
  let x = a.x;
  let y = a.y;
  const segmentX = b.x - x;
  const segmentY = b.y - y;

  if (segmentX || segmentY) {
    const projection = Math.max(0, Math.min(
      1,
      ((point.x - x) * segmentX + (point.y - y) * segmentY)
        / (segmentX * segmentX + segmentY * segmentY),
    ));
    x += segmentX * projection;
    y += segmentY * projection;
  }

  return Math.hypot(point.x - x, point.y - y);
}

function interiorDistance(point, ring) {
  if (!pointInRing(point, ring)) return -1;
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < ring.length; index += 1) {
    distance = Math.min(
      distance,
      distanceToSegment(point, ring[index], ring[(index + 1) % ring.length]),
    );
  }
  return distance;
}

/**
 * Find a stable label anchor well inside one of a city's polygon components.
 * Unlike a bbox center or centroid, this cannot land in an excluded/overlaid
 * city merely because that city sits near the middle of an irregular region.
 */
export function findInteriorPoint(path) {
  const rings = parsePathRings(path);
  let best = { x: 0, y: 0, distance: -1 };

  for (const ring of rings) {
    const xs = ring.map((point) => point.x);
    const ys = ring.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    let step = Math.max(maxX - minX, maxY - minY) / 16;

    if (!Number.isFinite(step) || step === 0) continue;

    for (let y = minY + step / 2; y <= maxY; y += step) {
      for (let x = minX + step / 2; x <= maxX; x += step) {
        const distance = interiorDistance({ x, y }, ring);
        if (distance > best.distance) best = { x, y, distance };
      }
    }

    for (let iteration = 0; iteration < 10; iteration += 1) {
      step /= 2;
      const center = { ...best };
      for (let yOffset = -2; yOffset <= 2; yOffset += 1) {
        for (let xOffset = -2; xOffset <= 2; xOffset += 1) {
          const point = {
            x: center.x + xOffset * step,
            y: center.y + yOffset * step,
          };
          const distance = interiorDistance(point, ring);
          if (distance > best.distance) best = { ...point, distance };
        }
      }
    }
  }

  return { x: best.x, y: best.y };
}
