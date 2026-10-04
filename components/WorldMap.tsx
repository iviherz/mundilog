'use client';
import {countryName} from '@/lib/i18n';


import { useLocale } from '@/components/LocaleProvider';
import { useEffect, useMemo, useState, useRef, useId, useCallback } from 'react';
import { geoEqualEarth, geoOrthographic, geoPath, geoGraticule10 } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';
import countries from '@/lib/data/countries.json';
import {mapColor} from '@/lib/map-colors';
import { RotationPad } from './RotationPad';
import type { State } from '@/lib/types';
const names = new Map(countries.map(c => [c.numeric, c]));
export function WorldMap({
  states,
  color = '#C6F532',
  onSelect,
  globe = false,
  others = [],
  filter = 'visited',
  comparison = false
}: {
  states: State[];
  color?: string;
  onSelect?: (code: string) => void;
  globe?: boolean;
  others?: {
    states: State[];
    color: string;
    name: string;
  }[];
  filter?: 'visited' | 'wishlist';
  comparison?: boolean;
}) {
  const {
    locale,
    tr
  } = useLocale();
  const [atlas, setAtlas] = useState<FeatureCollection<Geometry> | null>(null);
  const [rotation, setRotation] = useState<[number,number]>([0,-15]);
  const drag=useRef<{id:number;x:number;y:number;startX:number;startY:number}|null>(null);
  const suppressClick=useRef(false);const uid=useId().replace(/:/g,'');
  const rotate=useCallback((x:number,y:number)=>setRotation(r=>[((r[0]+x)%360+360)%360,((r[1]-y)%360+360)%360]),[]);
  useEffect(()=>{const stop=()=>{drag.current=null;};window.addEventListener('blur',stop);return()=>window.removeEventListener('blur',stop);},[]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    fetch('/data/world.json', {
      signal: c.signal
    }).then(r => {
      if (!r.ok) throw Error();
      return r.json();
    }).then(a => setAtlas(feature(a as Topology, a.objects.countries as GeometryCollection) as FeatureCollection<Geometry>)).catch(e => {
      if (e.name !== 'AbortError') setError(true);
    });
    return () => c.abort();
  }, []);
  const projection = useMemo(() => globe ? geoOrthographic().scale(210).translate([440, 230]).rotate(rotation) : geoEqualEarth().fitExtent([[15, 20], [865, 425]], {
    type: 'Sphere'
  }), [globe, rotation]);
  const path = geoPath(projection);
  const own = new Map(states.map(s => [s.country_code, s]));
  if (error) return <p role="alert">{tr("No pudimos cargar el mapa. Podés usar la lista de países.")}</p>;
  return <div className={'map-frame ' + (globe ? 'globe' : '')}>
 {!atlas ? <p className="map-loading">{tr("Cargando el mundo…")}</p> : <svg data-longitude={rotation[0]} data-latitude={rotation[1]} onPointerDown={e=>{if(!globe||e.button!==0)return;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};suppressClick.current=false;}} onPointerMove={e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;const scale=880/e.currentTarget.getBoundingClientRect().width;if(Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>5){suppressClick.current=true;if(!e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.setPointerCapture(e.pointerId);}rotate((e.clientX-d.x)*scale*.28,(e.clientY-d.y)*scale*.28);d.x=e.clientX;d.y=e.clientY;}} onPointerUp={e=>{if(drag.current?.id===e.pointerId)drag.current=null;}} onPointerCancel={()=>{drag.current=null;suppressClick.current=true;}} onLostPointerCapture={()=>{drag.current=null;}} style={{touchAction:globe?'none':'auto'}} viewBox="0 0 880 460" className="world-map" aria-label={globe ? tr("Globo de tu mundo") : tr("Mapa Equal Earth de tu mundo")}>
 <defs>{others.map((o, i) => <pattern key={i} id={uid+'peer-' + i} width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill={mapColor(o.color)} /><path d="M0 4H8" stroke="#FFFFFF" strokeWidth="2" /></pattern>)}<pattern id={uid+"common"} width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#D5B6FF" /><path d="M0 7L7 0" stroke="#151515" strokeWidth="1" /></pattern><pattern id={uid+"wish"} width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#FF83BD" /><circle cx="3" cy="3" r="1" fill="#151515" /></pattern></defs>
 <path d={path({
        type: 'Sphere'
      }) || ''} fill="#F5F5F5" stroke="#151515" /><path d={path(geoGraticule10()) || ''} fill="none" stroke="#CFCFCF" strokeWidth="0.5" />
 {atlas.features.map(f => {
        const c = names.get(String(f.id));
        if (!c || c.code === 'ATA') return null;
        const s = own.get(c.code);
        const matches = others.filter(o => o.states.some(x => x.country_code === c.code && x[filter]));
        const mine = comparison ? s?.[filter] : s?.visited;
        const shared = Boolean(mine && matches.length) || matches.length > 1;
        const fill = shared ? `url(#${uid}common)` : mine ? mapColor(color) : matches.length ? matches[0].color === color ? 'url(#'+uid+'peer-' + others.indexOf(matches[0]) + ')' : mapColor(matches[0].color) : !comparison && s?.wishlist ? `url(#${uid}wish)` : '#DEDEDE';
        const description = `${countryName(c,locale)}${s?.visited ? ', '+tr('Visitado') : ''}${s?.wishlist ? ', '+tr('Quiero ir') : ''}${matches.length ? ', ' + matches.map(m => m.name).join(', ') : ''}`;
        return <path key={c.code} d={path(f) || ''} fill={fill} stroke={fill === '#DEDEDE' ? '#666666' : '#FFFFFF'} strokeWidth="0.8" role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={description} onClick={() => {if(!suppressClick.current)onSelect?.(c.code);suppressClick.current=false;}} onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect?.(c.code);
          }
        }}><title>{description}</title></path>;
      })}
 </svg>}
 {globe && <RotationPad onRotate={rotate} onReset={()=>setRotation([0,-15])} />}
 <p className="map-source">{tr("Natural Earth · Equal Earth")}{globe ? ' / Orthographic' : ''}{tr(" · Los territorios pequeños también están en la lista.")}</p>
 </div>;
}
