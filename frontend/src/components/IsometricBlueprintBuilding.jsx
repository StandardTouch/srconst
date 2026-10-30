import React, { useState } from 'react';
import { Layers, ArrowRight, Check, Compass, Eye, Sparkles } from 'lucide-react';

export default function IsometricBlueprintBuilding({
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

  // Calculate live inventory stats per floor
  const floorStats = (floorNum) => {
    const floorFlats = flats.filter(f => f.floorNumber === floorNum);
    const avail = floorFlats.filter(f => f.status === 'Available').length;
    const inProc = floorFlats.filter(f => f.status === 'In Process').length;
    const sold = floorFlats.filter(f => f.status === 'Sold').length;
    return {
      total: floorFlats.length || 8,
      avail: floorFlats.length ? avail : 4,
      inProc: floorFlats.length ? inProc : 2,
      sold: floorFlats.length ? sold : 2
    };
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      background: '#fafafa',
      borderRadius: 12,
      border: '1px solid #000000',
      boxShadow: '5px 5px 0px #000000',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Top Technical Blueprint Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #000000',
        background: '#fafafa',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
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
            <span style={{ color: '#ff5b29', fontWeight: 700 }}>// ARCHITECTURAL ELEVATION</span>
            <span>•</span>
            <span>{site?.name || 'SITE MASTERPLAN'}</span>
          </div>
          <h2 style={{
            margin: '2px 0 0 0',
            fontSize: '1.3rem',
            fontWeight: 700,
            color: '#000000',
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            <span>{block?.name || 'Tower Alpha'}</span>
            <span style={{
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 4,
              border: '1px solid #000000',
              background: '#f5ff80',
              color: '#000000'
            }}>
              {totalFloors} STOREYS • {block?.unitsPerFloor || 8} FLATS / FLOOR
            </span>
          </h2>
        </div>

        {/* Active Floor Tag */}
        <div style={{
          fontFamily: "var(--font-geist-mono, monospace)",
          background: '#000000',
          color: '#fafafa',
          padding: '6px 14px',
          borderRadius: 9999,
          fontSize: '12px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff5b29' }} />
          <span>LEVEL {String(selectedFloor || 1).padStart(2, '0')} ACTIVE</span>
        </div>
      </div>

      {/* Main Isometric Line-Art Technical Diagram Canvas */}
      <div style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        overflowY: 'auto'
      }}>
        {/* Graph Paper Grid Canvas Overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          pointerEvents: 'none'
        }} />

        {/* Technical Isometric Tower Assembly (Engineered Line-Art) */}
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: '560px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 10
        }}>
          {/* Isometric Roof Crown / Parapet (Stippled Technical Box Top) */}
          <div style={{
            position: 'relative',
            width: '280px',
            height: '42px',
            border: '1.5px solid #000000',
            borderBottom: 'none',
            background: 'repeating-linear-gradient(45deg, #f5ff80, #f5ff80 4px, #fafafa 4px, #fafafa 8px)',
            boxShadow: '4px 0px 0px #000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: '11px',
              fontWeight: 700,
              background: '#000000',
              color: '#fafafa',
              padding: '2px 10px',
              borderRadius: 2
            }}>
              // ROOFTOP PENTHOUSE & SERVICE DECK
            </div>
          </div>

          {/* Stacked Floor Slabs (Interactive Isometric Slices) */}
          <div style={{
            width: '280px',
            border: '1.5px solid #000000',
            background: '#ffffff',
            boxShadow: '5px 5px 0px #000000',
            position: 'relative'
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
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 10px',
                    borderBottom: floorNum === 1 ? 'none' : '1px solid #000000',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.14s cubic-bezier(0.2, 0, 0, 1)',
                    transform: isSelected 
                      ? 'translateX(-12px)' 
                      : isHovered 
                      ? 'translateX(-6px)' 
                      : 'translateX(0)',
                    background: isSelected 
                      ? '#f5ff80' 
                      : isHovered 
                      ? 'rgba(255, 91, 41, 0.12)' 
                      : '#ffffff',
                    boxShadow: isSelected 
                      ? '4px 4px 0px #000000' 
                      : isHovered 
                      ? '2px 2px 0px #000000' 
                      : 'none',
                    zIndex: isSelected ? 20 : isHovered ? 15 : 1
                  }}
                >
                  {/* Left: Level Identifier */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <span style={{
                      fontFamily: "var(--font-geist-mono, monospace)",
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: isSelected ? '#ff5b29' : '#000000'
                    }}>
                      L{String(floorNum).padStart(2, '0')}
                    </span>
                    <span style={{
                      fontFamily: "var(--font-geist-mono, monospace)",
                      fontSize: '9.5px',
                      color: '#6c6c6c'
                    }}>
                      // STOREY
                    </span>
                  </div>

                  {/* Center Architectural Column Hatch */}
                  <div style={{
                    display: 'flex',
                    gap: 4,
                    alignItems: 'center'
                  }}>
                    {[...Array(6)].map((_, cIdx) => (
                      <div
                        key={cIdx}
                        style={{
                          width: '4px',
                          height: '14px',
                          border: '1px solid #000000',
                          background: isSelected ? '#000000' : '#ffffff'
                        }}
                      />
                    ))}
                  </div>

                  {/* Right: Technical Inventory Breakdown */}
                  <div style={{
                    fontFamily: "var(--font-geist-mono, monospace)",
                    fontSize: '10px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <span style={{ color: '#000000' }}>
                      <b style={{ color: '#059669' }}>{stats.avail}A</b>
                    </span>
                    <span style={{ color: '#b3b3b3' }}>/</span>
                    <span style={{ color: '#000000' }}>
                      <b style={{ color: '#d97706' }}>{stats.inProc}T</b>
                    </span>
                    <span style={{ color: '#b3b3b3' }}>/</span>
                    <span style={{ color: '#000000' }}>
                      <b style={{ color: '#dc2626' }}>{stats.sold}S</b>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Foundation & Ground Lobby Base */}
          <div style={{
            width: '300px',
            height: '32px',
            border: '1.5px solid #000000',
            borderTop: 'none',
            background: '#242424',
            color: '#fafafa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "var(--font-geist-mono, monospace)",
            fontSize: '10.5px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            boxShadow: '5px 5px 0px #000000'
          }}>
            // GRAND DROP-OFF & RECEPTION LOBBY
          </div>
        </div>
      </div>

      {/* Bottom Technical Legend & Tower Switcher */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid #000000',
        background: '#fafafa',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12
      }}>
        {/* Tower Selector Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {site?.blocks?.map(b => {
            const isSelected = (selectedBlock?.name === b.name);
            return (
              <button
                key={b.name}
                onClick={() => {
                  onSelectBlock(b);
                  onSelectFloor(selectedFloor || 4);
                }}
                style={{
                  fontFamily: "var(--font-geist-mono, monospace)",
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '6px 14px',
                  borderRadius: 9999,
                  border: '1px solid #000000',
                  background: isSelected ? '#000000' : '#ffffff',
                  color: isSelected ? '#fafafa' : '#000000',
                  boxShadow: isSelected ? '2px 2px 0px #ff5b29' : '2px 2px 0px #000000',
                  cursor: 'pointer',
                  transition: 'all 0.1s ease'
                }}
              >
                {b.name}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{
          fontFamily: "var(--font-geist-mono, monospace)",
          fontSize: '11px',
          fontWeight: 600,
          display: 'flex',
          gap: 12,
          color: '#000000'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, border: '1px solid #000', background: '#ffffff' }} /> A = Available
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, border: '1px solid #000', background: '#f5ff80' }} /> T = Token Taken
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, border: '1px solid #000', background: '#ff5b29' }} /> S = Sold Out
          </span>
        </div>
      </div>
    </div>
  );
}
