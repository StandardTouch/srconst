import React, { useState } from 'react';
import { Building, Layers, Eye, CheckCircle2, Clock, AlertCircle, Sparkles } from 'lucide-react';
import { getAssetUrl } from '../utils/assetUrl';

export default function ArchitecturalElevationViewer({
  site,
  selectedBlock,
  onSelectBlock,
  selectedFloor,
  onSelectFloor
}) {
  const [hoveredFloor, setHoveredFloor] = useState(null);

  const block = selectedBlock || site?.blocks?.[0];
  const totalFloors = block?.totalFloors || 14;
  const flats = block?.flats || [];

  // Elevation photo from block or default real architectural facade
  const elevationPhoto = block?.elevationRender || '/assets/srconst/brochure/tower_elevation_real.jpg';

  // Calculate live inventory stats per floor
  const floorStats = (floorNum) => {
    const floorFlats = flats.filter(f => f.floorNumber === floorNum);
    const avail = floorFlats.filter(f => f.status === 'Available').length;
    const inProc = floorFlats.filter(f => f.status === 'In Process').length;
    const sold = floorFlats.filter(f => f.status === 'Sold').length;
    return { total: floorFlats.length || 8, avail, inProc, sold };
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      background: 'linear-gradient(180deg, #0b0f19 0%, #111827 100%)',
      borderRadius: 18,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
    }}>
      {/* Top Architectural Header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 20
      }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: '#c5a880', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
            Architectural Elevation View
          </div>
          <h3 style={{ margin: '2px 0 0 0', fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{block?.name || 'Main Tower'}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 6 }}>
              {totalFloors} Storeys • {block?.unitsPerFloor || 8} Flats / Floor
            </span>
          </h3>
        </div>

        {/* Selected Floor Pill */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(197, 168, 128, 0.4)',
          borderRadius: 8,
          padding: '5px 12px',
          fontSize: '0.78rem',
          fontWeight: 700,
          color: '#e2c99c',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
          <span>Active: Level {String(selectedFloor || 1).padStart(2, '0')}</span>
        </div>
      </div>

      {/* Main Building Facade with Floor Elevation Overlays */}
      <div style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        padding: '16px 20px'
      }}>
        {/* Real Architectural Skyscraper Elevation Photo */}
        <div style={{
          position: 'relative',
          height: '100%',
          maxHeight: '620px',
          width: 'auto',
          aspectRatio: '3/4',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255,255,255,0.1)',
          background: '#030712'
        }}>
          <img
            src={getAssetUrl(elevationPhoto)}
            alt={`${block?.name} Real Facade Elevation`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 15%',
              display: 'block',
              filter: 'brightness(0.92) contrast(1.05)'
            }}
            onError={(e) => {
              e.target.src = getAssetUrl('/assets/srconst/brochure/floor_plan_preview.jpg');
            }}
          />

          {/* Vignette Gradient Overlay for Executive Contrast */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to right, rgba(11, 15, 25, 0.82) 0%, rgba(11, 15, 25, 0.2) 35%, rgba(11, 15, 25, 0.2) 65%, rgba(11, 15, 25, 0.82) 100%)',
            pointerEvents: 'none'
          }} />

          {/* Interactive Storey Strips Overlaid on Building Photo */}
          <div style={{
            position: 'absolute',
            inset: '3.5% 0 5% 0',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            pointerEvents: 'auto'
          }}>
            {Array.from({ length: totalFloors }, (_, idx) => {
              const floorNum = totalFloors - idx;
              const isSelected = selectedFloor === floorNum;
              const isHovered = hoveredFloor === floorNum;
              const stats = floorStats(floorNum);

              return (
                <div
                  key={floorNum}
                  onClick={() => onSelectFloor(floorNum)}
                  onMouseEnter={() => setHoveredFloor(floorNum)}
                  onMouseLeave={() => setHoveredFloor(null)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 12px',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.18s ease',
                    background: isSelected 
                      ? 'linear-gradient(90deg, rgba(197, 168, 128, 0.4) 0%, rgba(197, 168, 128, 0.2) 50%, rgba(197, 168, 128, 0.4) 100%)'
                      : isHovered 
                      ? 'rgba(255, 255, 255, 0.12)' 
                      : 'transparent',
                    borderTop: isSelected 
                      ? '1.5px solid #d4af37' 
                      : isHovered 
                      ? '1px solid rgba(255, 255, 255, 0.25)' 
                      : '1px solid rgba(255, 255, 255, 0.05)',
                    borderBottom: isSelected ? '1.5px solid #d4af37' : 'none',
                    boxShadow: isSelected ? '0 0 15px rgba(212, 175, 55, 0.4)' : 'none'
                  }}
                >
                  {/* Left: Floor Label Badge */}
                  <div style={{
                    background: isSelected ? '#d4af37' : 'rgba(15, 23, 42, 0.85)',
                    color: isSelected ? '#0f172a' : '#f8fafc',
                    padding: '1px 8px',
                    borderRadius: 4,
                    fontSize: '10.5px',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    border: isSelected ? 'none' : '1px solid rgba(255, 255, 255, 0.15)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    L{String(floorNum).padStart(2, '0')}
                  </div>

                  {/* Center Line for Visual Alignment */}
                  <div style={{
                    flex: 1,
                    height: 1,
                    background: isSelected ? 'rgba(212, 175, 55, 0.6)' : 'rgba(255, 255, 255, 0.08)',
                    margin: '0 8px'
                  }} />

                  {/* Right: Real-time Floor Inventory Pill (Available, Token, Sold) */}
                  <div style={{
                    display: 'flex',
                    gap: 4,
                    alignItems: 'center',
                    background: 'rgba(15, 23, 42, 0.88)',
                    backdropFilter: 'blur(4px)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    border: isSelected ? '1px solid rgba(212, 175, 55, 0.6)' : '1px solid rgba(255, 255, 255, 0.12)',
                    fontSize: '9.5px',
                    fontWeight: 700
                  }}>
                    <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981' }} />
                      {stats.avail}
                    </span>
                    <span style={{ color: '#94a3b8' }}>•</span>
                    <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b' }} />
                      {stats.inProc}
                    </span>
                    <span style={{ color: '#94a3b8' }}>•</span>
                    <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444' }} />
                      {stats.sold}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Hint & Tower Switcher */}
      <div style={{
        padding: '10px 20px',
        background: 'rgba(15, 23, 42, 0.85)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.74rem',
        color: '#94a3b8'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c5a880', fontWeight: 600 }}>
          <Sparkles size={13} color="#c5a880" />
          <span>Click any floor level above to inspect its real architectural floor plan</span>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, fontWeight: 600 }}>
          <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> Available
          </span>
          <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} /> In Process (Token)
          </span>
          <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} /> Sold Out
          </span>
        </div>
      </div>
    </div>
  );
}
