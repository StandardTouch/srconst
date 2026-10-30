import React, { useState, useMemo } from 'react';
import { Eye, Filter, Sparkles, Check } from 'lucide-react';
import { getAssetUrl } from '../utils/assetUrl';

export default function FloorPlateViewer({
  site,
  block,
  floorNumber,
  flats = [],
  onSelectFlat,
  selectedFlat
}) {
  const [hoveredFlatId, setHoveredFlatId] = useState(null);
  const [displayMode, setDisplayMode] = useState('blueprint'); // 'blueprint' | 'matrix'
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Available' | 'In Process' | 'Sold'

  // Filter flats for this floor
  const floorFlats = flats.filter(f => f.floorNumber === floorNumber);
  const unitCount = floorFlats.length || block?.unitsPerFloor || 8;

  // Floor-level inventory counts
  const floorCounts = useMemo(() => {
    let avail = 0;
    let inProc = 0;
    let sold = 0;
    floorFlats.forEach(f => {
      if (f.status === 'Available') avail++;
      else if (f.status === 'In Process') inProc++;
      else if (f.status === 'Sold') sold++;
    });
    if (floorFlats.length === 0) {
      avail = 4;
      inProc = 2;
      sold = 2;
    }
    const total = floorFlats.length || unitCount;
    return {
      total,
      avail,
      inProc,
      sold,
      availPct: Math.round((avail / total) * 100),
      inProcPct: Math.round((inProc / total) * 100),
      soldPct: Math.round((sold / total) * 100)
    };
  }, [floorFlats, unitCount]);

  // Exact 8-flat calibrated boundary coordinates on the master brochure floor plan
  const hotspots = useMemo(() => {
    if (unitCount <= 4) {
      return [
        { unitIndex: 2, x: 3.5, y: 3.0, w: 44.5, h: 45.0, side: 'West', label: 'Flat 2' },
        { unitIndex: 3, x: 53.0, y: 3.0, w: 44.5, h: 45.0, side: 'East', label: 'Flat 3' },
        { unitIndex: 1, x: 3.5, y: 52.0, w: 44.5, h: 45.0, side: 'South-West', label: 'Flat 1' },
        { unitIndex: 4, x: 53.0, y: 52.0, w: 44.5, h: 45.0, side: 'South-East', label: 'Flat 4' }
      ];
    }

    return [
      { unitIndex: 4, x: 3.5, y: 2.2, w: 44.5, h: 22.8, side: 'North-West', label: 'Flat 4' },
      { unitIndex: 5, x: 53.0, y: 2.2, w: 44.5, h: 22.8, side: 'North-East', label: 'Flat 5' },
      { unitIndex: 3, x: 3.5, y: 26.5, w: 44.5, h: 22.5, side: 'West', label: 'Flat 3' },
      { unitIndex: 6, x: 53.0, y: 26.5, w: 44.5, h: 22.5, side: 'East', label: 'Flat 6' },
      { unitIndex: 2, x: 3.5, y: 50.5, w: 44.5, h: 22.5, side: 'West', label: 'Flat 2' },
      { unitIndex: 7, x: 53.0, y: 50.5, w: 44.5, h: 22.5, side: 'East', label: 'Flat 7' },
      { unitIndex: 1, x: 3.5, y: 74.5, w: 44.5, h: 23.5, side: 'South-West', label: 'Flat 1' },
      { unitIndex: 8, x: 53.0, y: 74.5, w: 44.5, h: 23.5, side: 'South-East', label: 'Flat 8' }
    ];
  }, [unitCount]);

  // Timescale-compliant styling for flat status
  // Notice: AVAILABLE flats have NO dark colors (transparent background to let brochure shine through)
  const getStatusStyles = (status) => {
    switch (status) {
      case 'Available':
        return { 
          border: '#000000', 
          fill: 'transparent', // NO dark color! Completely clear view of rooms & brochure
          fillHover: 'rgba(255, 255, 255, 0.15)',
          badgeBg: '#ffffff', 
          badgeText: '#000000',
          badgeBorder: '#000000',
          label: 'AVAILABLE',
          watermark: null,
          dotColor: '#059669',
          priceColor: '#000000'
        };
      case 'In Process':
        return { 
          border: '#000000', 
          fill: 'rgba(245, 255, 128, 0.22)', // Timescale Chartreuse subtle wash
          fillHover: 'rgba(245, 255, 128, 0.35)',
          badgeBg: '#f5ff80', 
          badgeText: '#000000',
          badgeBorder: '#000000',
          label: 'TOKEN HELD',
          watermark: '// TOKEN HELD',
          dotColor: '#ff5b29',
          priceColor: '#ff5b29'
        };
      case 'Sold':
        return { 
          border: '#000000', 
          fill: 'rgba(0, 0, 0, 0.28)', // Technical architectural shaded wash
          fillHover: 'rgba(0, 0, 0, 0.38)',
          badgeBg: '#000000', 
          badgeText: '#ffffff',
          badgeBorder: '#000000',
          label: 'SOLD OUT',
          watermark: '// SOLD OUT',
          dotColor: '#ffffff',
          priceColor: '#6c6c6c'
        };
      default:
        return { 
          border: '#000000', 
          fill: 'transparent',
          fillHover: 'rgba(0, 0, 0, 0.05)',
          badgeBg: '#ffffff', 
          badgeText: '#000000',
          badgeBorder: '#000000',
          label: 'UNKNOWN',
          watermark: null,
          dotColor: '#6c6c6c',
          priceColor: '#000000'
        };
    }
  };

  const formatPrice = (val) => {
    if (!val) return '₹-';
    return (val / 100000).toFixed(2) + ' L';
  };

  const blueprintSrc = site?.masterPlan || '/assets/srconst/brochure/floor_plan_master.webp';
  const blueprintFallback = site?.previewImage || '/assets/srconst/brochure/floor_plan_preview.jpg';

  return (
    <div style={{
      background: '#fafafa',
      borderRadius: 12,
      border: '1px solid #000000',
      boxShadow: '5px 5px 0px #000000',
      padding: '20px',
      color: '#000000'
    }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #000000',
        paddingBottom: 14,
        marginBottom: 16
      }}>
        <div>
          <div style={{
            fontFamily: "var(--font-geist-mono, monospace)",
            fontSize: '11px',
            color: '#6c6c6c',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span style={{ color: '#ff5b29', fontWeight: 700 }}>// BROCHURE BLUEPRINT</span>
            <span>•</span>
            <span>{site?.name || 'Site'} • {block?.name}</span>
          </div>
          <h2 style={{
            margin: '2px 0 0 0',
            fontSize: '1.35rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            <span>Level {String(floorNumber).padStart(2, '0')} Floor Plate</span>
            <span style={{
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 4,
              border: '1px solid #000000',
              background: '#ffffff'
            }}>
              {unitCount} TOTAL UNITS
            </span>
          </h2>
        </div>

        {/* View Mode Switcher Pills */}
        <div style={{
          display: 'flex',
          gap: 6
        }}>
          <button
            onClick={() => setDisplayMode('blueprint')}
            style={{
              fontFamily: "var(--font-geist, sans-serif)",
              fontSize: '12px',
              fontWeight: 600,
              padding: '6px 14px',
              borderRadius: 9999,
              border: '1px solid #000000',
              background: displayMode === 'blueprint' ? '#000000' : '#ffffff',
              color: displayMode === 'blueprint' ? '#fafafa' : '#000000',
              boxShadow: displayMode === 'blueprint' ? '2px 2px 0px #000000' : 'none',
              cursor: 'pointer'
            }}
          >
            Floor Blueprint
          </button>
          <button
            onClick={() => setDisplayMode('matrix')}
            style={{
              fontFamily: "var(--font-geist, sans-serif)",
              fontSize: '12px',
              fontWeight: 600,
              padding: '6px 14px',
              borderRadius: 9999,
              border: '1px solid #000000',
              background: displayMode === 'matrix' ? '#000000' : '#ffffff',
              color: displayMode === 'matrix' ? '#fafafa' : '#000000',
              boxShadow: displayMode === 'matrix' ? '2px 2px 0px #000000' : 'none',
              cursor: 'pointer'
            }}
          >
            Unit Grid List
          </button>
        </div>
      </div>

      {/* Technical Floor-Level Inventory KPI Bar */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #000000',
        borderRadius: 8,
        padding: '10px 16px',
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        boxShadow: '3px 3px 0px #000000'
      }}>
        {/* Left: Quick Counts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: "var(--font-geist-mono, monospace)",
            fontSize: '11px',
            color: '#6c6c6c',
            fontWeight: 700
          }}>
            // INVENTORY:
          </span>

          <div style={{
            fontFamily: "var(--font-geist-mono, monospace)",
            background: '#ffffff',
            border: '1px solid #000000',
            padding: '2px 10px',
            borderRadius: 9999,
            fontSize: '11.5px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }} />
            <span>{floorCounts.avail} AVAILABLE ({floorCounts.availPct}%)</span>
          </div>

          <div style={{
            fontFamily: "var(--font-geist-mono, monospace)",
            background: '#f5ff80',
            border: '1px solid #000000',
            padding: '2px 10px',
            borderRadius: 9999,
            fontSize: '11.5px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff5b29' }} />
            <span>{floorCounts.inProc} TOKEN HELD ({floorCounts.inProcPct}%)</span>
          </div>

          <div style={{
            fontFamily: "var(--font-geist-mono, monospace)",
            background: '#242424',
            color: '#fafafa',
            border: '1px solid #000000',
            padding: '2px 10px',
            borderRadius: 9999,
            fontSize: '11.5px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffffff' }} />
            <span>{floorCounts.sold} SOLD OUT ({floorCounts.soldPct}%)</span>
          </div>
        </div>

        {/* Right: Instant Filter Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: "var(--font-geist-mono, monospace)",
            fontSize: '11px',
            color: '#6c6c6c',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}>
            <Filter size={11} /> FILTER:
          </span>
          {['All', 'Available', 'In Process', 'Sold'].map(st => {
            const isFilterActive = statusFilter === st;
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  fontFamily: "var(--font-geist-mono, monospace)",
                  background: isFilterActive ? '#000000' : '#ffffff',
                  border: '1px solid #000000',
                  color: isFilterActive ? '#ffffff' : '#000000',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {st === 'All' ? 'ALL (8)' : st === 'In Process' ? 'TOKEN (2)' : st.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode 1: Interactive Real Brochure Blueprint */}
      {displayMode === 'blueprint' ? (
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: '780px',
          margin: '0 auto',
          borderRadius: 8,
          overflow: 'hidden',
          border: '1.5px solid #000000',
          background: '#ffffff',
          boxShadow: '4px 4px 0px #000000'
        }}>
          {/* Master Architectural Blueprint Image from Brochure */}
          <img
            src={getAssetUrl(blueprintSrc)}
            alt={`${site?.name} Brochure Blueprint`}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              filter: 'contrast(1.02)'
            }}
            onError={(e) => {
              e.target.src = getAssetUrl(blueprintFallback);
            }}
          />

          {/* Interactive Flat Boundaries (Available flats have NO dark colors) */}
          <div style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'auto'
          }}>
            {hotspots.map((spot) => {
              const flat = floorFlats.find(f => f.unitIndex === spot.unitIndex) || {
                name: `${block?.prefix || 'T'}-${floorNumber}${String(spot.unitIndex).padStart(2, '0')}`,
                unitIndex: spot.unitIndex,
                status: spot.unitIndex % 3 === 0 ? 'Sold' : spot.unitIndex % 2 === 0 ? 'In Process' : 'Available',
                type: '3BHK Luxury',
                area: 1450,
                price: 9500000,
                facing: spot.side
              };

              const styles = getStatusStyles(flat.status);
              const isHovered = hoveredFlatId === flat.name;
              const isSelected = selectedFlat && selectedFlat.name === flat.name;
              const isFilteredOut = statusFilter !== 'All' && flat.status !== statusFilter;

              return (
                <div
                  key={spot.unitIndex}
                  onClick={() => onSelectFlat(flat)}
                  onMouseEnter={() => setHoveredFlatId(flat.name)}
                  onMouseLeave={() => setHoveredFlatId(null)}
                  style={{
                    position: 'absolute',
                    left: `${spot.x}%`,
                    top: `${spot.y}%`,
                    width: `${spot.w}%`,
                    height: `${spot.h}%`,
                    borderRadius: 8,
                    // Crisp hairline border
                    border: isSelected 
                      ? '2.5px solid #ff5b29' 
                      : isHovered 
                      ? '2px solid #000000' 
                      : '1.5px solid rgba(0, 0, 0, 0.75)',
                    // AVAILABLE = 100% transparent (no dark colors!), Sold = shaded, Token = chartreuse
                    background: isSelected 
                      ? 'rgba(255, 91, 41, 0.12)' 
                      : isHovered 
                      ? styles.fillHover 
                      : styles.fill,
                    boxShadow: isSelected 
                      ? '3px 3px 0px #000000' 
                      : isHovered 
                      ? '2px 2px 0px #000000' 
                      : 'none',
                    opacity: isFilteredOut ? 0.25 : 1,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    boxSizing: 'border-box'
                  }}
                >
                  {/* Top Badge: Unit Number & Status Tag */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    pointerEvents: 'none'
                  }}>
                    {/* Unit Pill */}
                    <div style={{
                      fontFamily: "var(--font-geist-mono, monospace)",
                      background: '#ffffff',
                      border: '1px solid #000000',
                      borderRadius: 4,
                      padding: '2px 7px',
                      color: '#000000',
                      fontSize: '11px',
                      fontWeight: 700,
                      boxShadow: '1px 1px 0px #000000',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: styles.dotColor }} />
                      Unit {flat.name.split('-').pop()}
                    </div>

                    {/* Status Badge */}
                    <div style={{
                      fontFamily: "var(--font-geist-mono, monospace)",
                      background: styles.badgeBg,
                      border: `1px solid ${styles.badgeBorder}`,
                      borderRadius: 4,
                      padding: '2px 7px',
                      color: styles.badgeText,
                      fontSize: '9.5px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      boxShadow: '1px 1px 0px #000000'
                    }}>
                      {styles.label}
                    </div>
                  </div>

                  {/* Center Watermark Stamp for Occupied or Token Flats */}
                  {styles.watermark ? (
                    <div style={{
                      alignSelf: 'center',
                      fontFamily: "var(--font-geist-mono, monospace)",
                      background: flat.status === 'Sold' ? '#000000' : '#f5ff80',
                      color: flat.status === 'Sold' ? '#ffffff' : '#000000',
                      border: '1px solid #000000',
                      borderRadius: 4,
                      padding: '3px 10px',
                      fontSize: '10px',
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      boxShadow: '2px 2px 0px #000000',
                      pointerEvents: 'none'
                    }}>
                      {styles.watermark}
                    </div>
                  ) : (
                    /* If Available and hovered, show click hint */
                    isHovered && (
                      <div style={{
                        alignSelf: 'center',
                        fontFamily: "var(--font-geist-mono, monospace)",
                        background: '#000000',
                        color: '#fafafa',
                        borderRadius: 4,
                        padding: '3px 8px',
                        fontSize: '10px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        pointerEvents: 'none',
                        boxShadow: '2px 2px 0px #ff5b29'
                      }}>
                        <Eye size={11} color="#f5ff80" /> Click to Inspect Layout
                      </div>
                    )
                  )}

                  {/* Bottom Footer: Type & Price (Crisp White Pill with Black Border) */}
                  <div style={{
                    fontFamily: "var(--font-geist-mono, monospace)",
                    background: '#ffffff',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: '9.5px',
                    color: '#000000',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    pointerEvents: 'none',
                    border: '1px solid #000000',
                    boxShadow: '1px 1px 0px #000000'
                  }}>
                    <span>{flat.type || '3BHK'} • {flat.area || 1450} sqft</span>
                    <span style={{ fontWeight: 800, color: styles.priceColor }}>{formatPrice(flat.price)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Blueprint Footer Strip */}
          <div style={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            right: 10,
            background: '#ffffff',
            border: '1px solid #000000',
            borderRadius: 6,
            padding: '6px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            fontFamily: "var(--font-geist-mono, monospace)",
            boxShadow: '2px 2px 0px #000000'
          }}>
            <div style={{ display: 'flex', gap: 14 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }} /> AVAILABLE (UNSHADED)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff5b29' }} /> TOKEN HELD
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#000000' }} /> SOLD OUT
              </span>
            </div>
            <div style={{ color: '#ff5b29', fontWeight: 700 }}>
              // CLICK ANY FLAT TO OPEN INTERIOR CUTAWAY
            </div>
          </div>
        </div>
      ) : (
        /* Mode 2: Detailed Flat Grid List */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {floorFlats.map((flat) => {
            const styles = getStatusStyles(flat.status);
            const isSelected = selectedFlat && selectedFlat.name === flat.name;

            return (
              <div
                key={flat.name}
                onClick={() => onSelectFlat(flat)}
                style={{
                  background: isSelected ? '#f5ff80' : '#ffffff',
                  border: '1.5px solid #000000',
                  borderRadius: 8,
                  padding: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '4px 4px 0px #ff5b29' : '3px 3px 0px #000000',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontFamily: "var(--font-geist-mono, monospace)",
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: '#000000'
                  }}>
                    Unit {flat.name}
                  </span>
                  <span style={{
                    fontFamily: "var(--font-geist-mono, monospace)",
                    background: styles.badgeBg,
                    color: styles.badgeText,
                    border: '1px solid #000000',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4
                  }}>
                    {flat.status}
                  </span>
                </div>
                <div style={{ margin: '8px 0', fontSize: '13px', color: '#6c6c6c' }}>
                  {flat.type} • {flat.facing} Facing • {flat.area} sqft
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #000000', paddingTop: 8 }}>
                  <span style={{
                    fontFamily: "var(--font-geist-mono, monospace)",
                    fontSize: '1rem',
                    fontWeight: 800,
                    color: '#000000'
                  }}>
                    {formatPrice(flat.price)}
                  </span>
                  <button style={{
                    background: '#000000',
                    border: '1px solid #000000',
                    color: '#fafafa',
                    padding: '5px 12px',
                    borderRadius: 9999,
                    fontSize: '11px',
                    fontFamily: "var(--font-geist-mono, monospace)",
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}>
                    Inspect →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
