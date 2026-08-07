// HUD rendering: status line, stats strip, hop timeline and detail card.
// Pure DOM manipulation against the static markup in index.html.

import { roleName, type Hop, type RouteResult } from '../net/route';
import { countUp, flagEmoji, formatKm, formatMs } from './format';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

export class Hud {
  private readonly status = el<HTMLDivElement>('status');
  private readonly statusText = el<HTMLSpanElement>('status-text');
  private readonly error = el<HTMLDivElement>('error');
  private readonly stats = el<HTMLElement>('stats');
  private readonly inspector = el<HTMLElement>('inspector');
  private readonly routeTitle = el<HTMLDivElement>('route-title');
  private readonly hopList = el<HTMLOListElement>('hop-list');
  private readonly hopDetail = el<HTMLDivElement>('hop-detail');
  private readonly tooltip = el<HTMLDivElement>('tooltip');

  onHopSelected: ((index: number) => void) | null = null;

  setStatus(message: string | null): void {
    this.status.hidden = !message;
    if (message) this.statusText.textContent = message;
  }

  setError(message: string | null): void {
    this.error.hidden = !message;
    if (message) this.error.textContent = message;
  }

  reset(): void {
    this.setStatus(null);
    this.setError(null);
    this.stats.hidden = true;
    this.inspector.hidden = true;
    this.hopDetail.hidden = true;
    this.tooltip.hidden = true;
    this.hopList.innerHTML = '';
  }

  showRoute(route: RouteResult): void {
    this.setStatus(null);
    this.setError(null);

    // --- stats strip
    this.stats.hidden = false;
    countUp(el('stat-distance'), route.totalKm, (v) => formatKm(v));
    countUp(el('stat-hops'), route.hops.length, (v) => `${Math.round(v)}`);
    countUp(el('stat-countries'), route.countries.length, (v) => `${Math.round(v)}`);
    el('stat-countries-flags').textContent = route.countries.map((c) => flagEmoji(c.cc)).join(' ');
    countUp(el('stat-light'), route.fiberMs, (v) => formatMs(v));
    el('stat-light-sub').textContent = `${formatMs(route.lightMs)} in vacuum · one-way`;
    const measured = el('stat-measured');
    const measuredSub = el('stat-measured-sub');
    if (route.measuredMs !== undefined) {
      countUp(measured, route.measuredMs, (v) => formatMs(v));
      measuredSub.textContent = route.measuredLabel ?? '';
    } else {
      measured.textContent = '—';
      measuredSub.textContent = route.kind === 'ip' ? 'no probe for bare IPs' : 'not measurable';
    }

    // --- hop timeline
    this.inspector.hidden = false;
    this.routeTitle.textContent = route.target;
    this.hopList.innerHTML = '';
    route.hops.forEach((hop, i) => {
      const li = document.createElement('li');
      li.className = `hop hop-${hop.role}`;
      li.dataset.index = String(i);
      const place = [hop.city, hop.country].filter(Boolean).join(', ');
      li.innerHTML = `
        <span class="hop-dot"></span>
        <span class="hop-body">
          <span class="hop-label">${escapeHtml(hop.label)}</span>
          <span class="hop-sub">${escapeHtml([roleName(hop.role), place || null, hop.hopMs !== undefined ? `+${formatMs(hop.hopMs)}` : null].filter(Boolean).join(' · '))}</span>
        </span>`;
      li.addEventListener('click', () => this.onHopSelected?.(i));
      this.hopList.appendChild(li);
    });
    this.hopDetail.hidden = true;
  }

  markHopReached(index: number): void {
    this.hopList.querySelectorAll<HTMLLIElement>('.hop').forEach((li, i) => {
      li.classList.toggle('reached', i <= index);
      li.classList.toggle('active', i === index);
    });
  }

  selectHop(route: RouteResult, index: number | null): void {
    this.hopList.querySelectorAll<HTMLLIElement>('.hop').forEach((li, i) => {
      li.classList.toggle('selected', i === index);
    });
    if (index === null) {
      this.hopDetail.hidden = true;
      return;
    }
    const hop = route.hops[index];
    if (!hop) return;
    this.hopDetail.hidden = false;
    this.hopDetail.innerHTML = renderDetail(hop, index, route);
  }

  showTooltip(hop: Hop | null, x: number, y: number): void {
    if (!hop) {
      this.tooltip.hidden = true;
      return;
    }
    this.tooltip.hidden = false;
    this.tooltip.innerHTML = `<strong>${escapeHtml(hop.label)}</strong><span>${escapeHtml(
      [roleName(hop.role), [hop.city, hop.country].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
    )}</span>`;
    const pad = 14;
    const w = this.tooltip.offsetWidth;
    const left = Math.min(window.innerWidth - w - pad, x + pad);
    this.tooltip.style.left = `${Math.max(pad, left)}px`;
    this.tooltip.style.top = `${Math.max(pad, y - this.tooltip.offsetHeight - pad)}px`;
  }
}

function renderDetail(hop: Hop, index: number, route: RouteResult): string {
  const rows: [string, string | undefined][] = [
    ['Role', roleName(hop.role)],
    ['IP', hop.ip],
    ['Hostname', hop.hostname && hop.hostname !== hop.label ? hop.hostname : undefined],
    ['Network', [hop.asn, hop.org].filter(Boolean).join(' · ') || undefined],
    ['Location', [hop.city, hop.region, hop.country].filter(Boolean).join(', ') || undefined],
    ['Coordinates', `${hop.lat.toFixed(2)}°, ${hop.lon.toFixed(2)}°`],
    ['From previous hop', hop.hopMs !== undefined ? formatMs(hop.hopMs) : undefined],
    ['Position', hop.approx ? 'estimated' : 'geolocated'],
  ];
  const cells = rows
    .filter((r): r is [string, string] => !!r[1])
    .map(([k, v]) => `<div class="kv"><span>${k}</span><span>${escapeHtml(v)}</span></div>`)
    .join('');
  const note = hop.note ? `<p class="hop-note">${escapeHtml(hop.note)}</p>` : '';
  return `<div class="detail-head"><span class="detail-index">${index + 1}/${route.hops.length}</span>${escapeHtml(hop.label)}</div>${cells}${note}`;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
