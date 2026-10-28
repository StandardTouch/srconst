import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RotateCcw, Compass, Sparkles, Layers, Maximize2, Play, Pause } from 'lucide-react';

export default function IsometricBuildingCanvas({
  site,
  selectedBlock,
  onSelectBlock,
  selectedFloor,
  onSelectFloor,
  lightingMode = 'dusk'
}) {
  const [hoveredFloor, setHoveredFloor] = useState(null);
  const [hoveredBlock, setHoveredBlock] = useState(null);
  const [animTime, setAnimTime] = useState(0);

  // Interactive Drag-to-Rotate, Tilt & Zoom States
  const [rotationY, setRotationY] = useState(-30); // Azimuth angle in degrees
  const [tiltX, setTiltX] = useState(60);         // Pitch / tilt angle in degrees (20° to 80°)
  const [zoomScale, setZoomScale] = useState(1);   // Zoom level (0.75 to 1.6)
  const [isAutoRotating, setIsAutoRotating] = useState(false);

  const containerRef = useRef(null);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  const blocks = site?.blocks || [];

  // Ambient lighting loop
  useEffect(() => {
    let frameId;
    const updateAnim = () => {
      setAnimTime(t => (t + 0.03) % (Math.PI * 2));
      if (isAutoRotating) {
        setRotationY(prev => (prev + 0.25) % 360);
      }
      frameId = requestAnimationFrame(updateAnim);
    };
    frameId = requestAnimationFrame(updateAnim);
    return () => cancelAnimationFrame(frameId);
  }, [isAutoRotating]);

  // Mouse & Touch Drag Handlers for Real Tilting & Orbiting
  const handlePointerDown = (e) => {
    // Only drag on canvas background, not on buttons or floor items
    if (e.target.closest('button') || e.target.closest('.floor-slab-item')) return;
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    if (isAutoRotating) setIsAutoRotating(false);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - lastMousePosRef.current.x;
    const deltaY = e.clientY - lastMousePosRef.current.y;

    // Horizontal drag -> Rotate around Y
    setRotationY(prev => prev + deltaX * 0.45);

    // Vertical drag -> Tilt pitch (constrained between 25° and 78°)
    setTiltX(prev => Math.min(78, Math.max(25, prev - deltaY * 0.35)));

    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  // Scroll wheel for zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomDelta = e.deltaY * -0.0012;
    setZoomScale(prev => Math.min(1.6, Math.max(0.75, prev + zoomDelta)));
  };

  // Preset Angle Handlers
  const resetOrientation = () => {
    setRotationY(-30);
    setTiltX(60);
    setZoomScale(1);
    setIsAutoRotating(false);
  };

  const setElevationView = () => {
    setRotationY(0);
    setTiltX(35);
    setZoomScale(1.05);
    setIsAutoRotating(false);
  };

  const setAerialView = () => {
    setRotationY(-45);
    setTiltX(75);
    setZoomScale(1.1);
    setIsAutoRotating(false);
  };

  const themeStyles = useMemo(() => {
    switch (lightingMode) {
      case 'night':
        return {
          bg: 'radial-gradient(circle at 50% 25%, #0f172a 0%, #030712 100%)',
          podiumBorder: 'rgba(56, 189, 248, 0.4)',
          glowColor: '#38bdf8',
          windowWarmth: 'rgba(253, 224, 71, 0.85)',
          skyGaze: '#0284c7'
        };
      case 'day':
        return {
          bg: 'radial-gradient(circle at 50% 25%, #1e293b 0%, #0f172a 100%)',
          podiumBorder: 'rgba(56, 189, 248, 0.3)',
          glowColor: '#0284c7',
          windowWarmth: 'rgba(255, 255, 255, 0.8)',
          skyGaze: '#38bdf8'
        };
      case 'dusk':
      default:
        return {
          bg: 'radial-gradient(circle at 50% 25%, #1a1e36 0%, #090d16 100%)',
          podiumBorder: 'rgba(245, 158, 11, 0.4)',
          glowColor: '#f59e0b',
          windowWarmth: 'rgba(251, 191, 36, 0.9)',
          skyGaze: '#fbbf24'
        };
    }
  }, [lightingMode]);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: themeStyles.bg,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        perspective: '1400px',
        cursor: 'grab'
      }}
    >
      {/* Top Controls Toolbar - Clean flex layout, NO overlapping absolute elements */}
      <div style={{
        position: 'absolute',
        top: 14,
        left: 14,
        right: 14,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 50,
        pointerEvents: 'none'
      }}>
        {/* Left: Campus View Return button */}
        <div style={{ pointerEvents: 'auto' }}>
          {selectedBlock ? (
            <button
              onClick={() => {
                onSelectBlock(null);
                onSelectFloor(null);
              }}
              style={{
                background: 'rgba(15, 23, 42, 0.92)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#fff',
                borderRadius: 8,
                padding: '7px 14px',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                transition: 'all 0.2s'
              }}
            >
              <RotateCcw size={14} />
              View All Towers
            </button>
          ) : (
            <div style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: '0.78rem',
              color: '#94a3b8',
              backdropFilter: 'blur(8px)'
            }}>
              🏢 Campus Overview
            </div>
          )}
        </div>

        {/* Center: Interactive Angle & Orbit Toolbar */}
        <div style={{
          display: 'flex',
          gap: 4,
          background: 'rgba(15, 23, 42, 0.92)',
          padding: '4px 6px',
          borderRadius: 10,
          border: '1px solid rgba(56, 189, 248, 0.3)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
          pointerEvents: 'auto'
        }}>
          <button
            onClick={resetOrientation}
            title="Reset to Default Angle"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#cbd5e1',
              padding: '5px 10px',
              borderRadius: 6,
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <RotateCcw size={13} />
            Reset
          </button>

          <button
            onClick={setElevationView}
            title="Front Elevation View"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#cbd5e1',
              padding: '5px 10px',
              borderRadius: 6,
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            📐 Elevation
          </button>

          <button
            onClick={setAerialView}
            title="High Aerial View"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#cbd5e1',
              padding: '5px 10px',
              borderRadius: 6,
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            🛸 Aerial
          </button>

          <button
            onClick={() => setIsAutoRotating(!isAutoRotating)}
            title="Toggle Continuous Turntable Rotation"
            style={{
              background: isAutoRotating ? '#0284c7' : 'transparent',
              border: 'none',
              color: isAutoRotating ? '#fff' : '#cbd5e1',
              padding: '5px 10px',
              borderRadius: 6,
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            {isAutoRotating ? <Pause size={12} /> : <Play size={12} />}
            Auto-Rotate
          </button>
        </div>

        {/* Right: Selected Floor Status Pill */}
        <div style={{ pointerEvents: 'auto' }}>
          {selectedBlock && (hoveredFloor || selectedFloor) && (
            <div style={{
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1.5px solid rgba(56, 189, 248, 0.5)',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#f8fafc',
              boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }} />
              <span>Level {String(hoveredFloor || selectedFloor).padStart(2, '0')}</span>
              <span style={{ color: '#10b981', fontSize: '0.72rem' }}>● Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic 3D Horizon Grid Plane (Rotates & Tilts with Mouse) */}
      <div style={{
        position: 'absolute',
        width: '240%',
        height: '240%',
        backgroundImage: `
          radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.12) 0%, transparent 65%),
          linear-gradient(rgba(56, 189, 248, 0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(56, 189, 248, 0.08) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 45px 45px, 45px 45px',
        transform: `rotateX(${tiltX}deg) rotateZ(${rotationY}deg) translateY(120px) scale(${zoomScale})`,
        transformStyle: 'preserve-3d',
        opacity: 0.85,
        transition: isDraggingRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)'
      }} />

      {/* Reflecting Water Feature on Podium */}
      <div style={{
        position: 'absolute',
        width: '680px',
        height: '420px',
        borderRadius: '36px',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.85) 100%)',
        border: `2px solid ${themeStyles.podiumBorder}`,
        transform: `rotateX(${tiltX}deg) rotateZ(${rotationY}deg) translateY(110px) scale(${zoomScale})`,
        boxShadow: `0 35px 80px rgba(0, 0, 0, 0.95), 0 0 50px ${themeStyles.glowColor}25`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        transition: isDraggingRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)'
      }}>
        <div style={{
          position: 'absolute',
          width: '92%',
          height: '86%',
          borderRadius: '26px',
          background: `radial-gradient(circle at ${50 + Math.sin(animTime) * 15}% ${50 + Math.cos(animTime) * 15}%, rgba(56, 189, 248, 0.25) 0%, rgba(15, 23, 42, 0.5) 75%)`,
          border: '1px solid rgba(56, 189, 248, 0.3)',
          boxShadow: 'inset 0 0 35px rgba(56, 189, 248, 0.25)'
        }} />
      </div>

      {/* 3D Skyscraper Towers Container (Orbiting & Tilting) */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: selectedBlock ? '0px' : '52px',
        zIndex: 10,
        transform: `rotateX(${Math.max(15, tiltX - 45)}deg) scale(${zoomScale * (selectedBlock ? 1.15 : 1)}) translateY(${selectedBlock ? '20px' : '0px'})`,
        transition: isDraggingRef.current ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}>
        {blocks.map((block) => {
          const isSelected = selectedBlock && selectedBlock.name === block.name;
          const isDimmed = selectedBlock && !isSelected;
          const totalFloors = Math.min(block.totalFloors || 14, 18);
          const blockColor = block.color || '#38bdf8';

          if (isDimmed) return null;

          return (
            <div
              key={block.name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative'
              }}
              onMouseEnter={() => setHoveredBlock(block)}
              onMouseLeave={() => setHoveredBlock(null)}
              onClick={() => onSelectBlock(block)}
            >
              {/* Floating Tower Title - Generous 32px clearance above Helipad so it NEVER collides */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.95)',
                border: `1.5px solid ${blockColor}`,
                borderRadius: 10,
                padding: '6px 16px',
                color: '#fff',
                marginBottom: 32, // Solved collision with helipad
                boxShadow: `0 8px 25px ${blockColor}44`,
                textAlign: 'center',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2
              }}>
                <div style={{ color: blockColor, fontSize: '0.85rem', fontWeight: 800 }}>
                  {block.name}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
                  {block.totalFloors} Floors • {block.unitsPerFloor || 8} Flats/Floor
                </div>
              </div>

              {/* Rooftop Penthouse Crown & Helipad with Pulsing Warning Beacon */}
              <div style={{
                position: 'relative',
                width: 140,
                height: 36,
                background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
                borderRadius: '10px 10px 0 0',
                border: `1.5px solid ${blockColor}99`,
                borderBottom: 'none',
                boxShadow: `0 0 20px ${blockColor}33`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 15
              }}>
                {/* Helipad Marking */}
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: '2px solid #facc15',
                  color: '#facc15',
                  fontSize: '10px',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 10px rgba(250, 204, 21, 0.5)'
                }}>
                  H
                </div>

                {/* Pulsing Beacon Light */}
                <div style={{
                  position: 'absolute',
                  top: -6,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#ef4444',
                  boxShadow: `0 0 ${10 + Math.sin(animTime * 3) * 6}px #ef4444`
                }} />
              </div>

              {/* Stacked Floor Plates & Illuminated Windows */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                width: 155,
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1.5px solid rgba(56, 189, 248, 0.35)',
                borderRadius: '0 0 8px 8px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.9)',
                overflow: 'visible'
              }}>
                {Array.from({ length: totalFloors }, (_, idx) => {
                  const floorNum = totalFloors - idx;
                  const isFloorActive = selectedFloor === floorNum;
                  const isHovered = hoveredFloor === floorNum;

                  return (
                    <div
                      key={floorNum}
                      className="floor-slab-item"
                      onMouseEnter={(e) => {
                        e.stopPropagation();
                        setHoveredFloor(floorNum);
                      }}
                      onMouseLeave={(e) => {
                        e.stopPropagation();
                        setHoveredFloor(null);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectBlock(block);
                        onSelectFloor(floorNum);
                      }}
                      style={{
                        height: 20,
                        position: 'relative',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
                        // Dynamic 3D Exploded Floor Slice Lift
                        transform: isFloorActive 
                          ? 'translateX(-16px) scale(1.08)' 
                          : isHovered 
                          ? 'translateX(-8px) scale(1.03)' 
                          : 'translateX(0) scale(1)',
                        zIndex: isFloorActive ? 25 : isHovered ? 20 : 10,
                        transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        background: isFloorActive 
                          ? 'linear-gradient(90deg, #c5a880 0%, #d4af37 100%)' 
                          : isHovered 
                          ? 'linear-gradient(90deg, rgba(197, 168, 128, 0.4) 0%, rgba(212, 175, 55, 0.5) 100%)' 
                          : 'rgba(15, 23, 42, 0.88)',
                        boxShadow: isFloorActive 
                          ? '0 0 18px rgba(212, 175, 55, 0.5), 0 8px 20px rgba(0,0,0,0.7)' 
                          : isHovered 
                          ? '0 0 10px rgba(197, 168, 128, 0.4)' 
                          : 'none',
                        borderRadius: isFloorActive || isHovered ? 5 : 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 8px',
                        cursor: 'pointer'
                      }}
                    >
                      {/* Floor Number Tag */}
                      <span style={{
                        fontSize: '9.5px',
                        fontWeight: 800,
                        color: isFloorActive ? '#ffffff' : '#94a3b8'
                      }}>
                        L{String(floorNum).padStart(2, '0')}
                      </span>

                      {/* Glass Window Cells */}
                      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                        {[...Array(6)].map((_, wIdx) => {
                          const isLit = (floorNum * 3 + wIdx) % 4 !== 0;
                          return (
                            <div
                              key={wIdx}
                              style={{
                                width: 8,
                                height: 10,
                                borderRadius: 1.5,
                                background: isFloorActive 
                                  ? '#ffffff' 
                                  : isLit 
                                  ? themeStyles.windowWarmth 
                                  : 'rgba(30, 41, 59, 0.8)',
                                boxShadow: isLit && !isFloorActive 
                                  ? `0 0 4px ${themeStyles.skyGaze}88` 
                                  : 'none',
                                opacity: isLit ? 0.95 : 0.35
                              }}
                            />
                          );
                        })}
                      </div>

                      {/* Balcony Railing */}
                      <div style={{
                        width: 12,
                        height: 11,
                        borderRadius: '0 3px 3px 0',
                        border: '1px solid rgba(56, 189, 248, 0.6)',
                        background: isFloorActive ? 'rgba(255,255,255,0.4)' : 'rgba(56, 189, 248, 0.25)'
                      }} />
                    </div>
                  );
                })}
              </div>

              {/* Grand Entrance Canopy */}
              <div style={{
                width: 165,
                height: 26,
                background: 'linear-gradient(180deg, #1e293b 0%, #090d16 100%)',
                border: `1.5px solid ${blockColor}88`,
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 25px rgba(0,0,0,0.8)',
                zIndex: 12
              }}>
                <div style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: blockColor,
                  textTransform: 'uppercase'
                }}>
                  GRAND DROP-OFF LOBBY
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Floating Hint Ribbon */}
      <div style={{
        position: 'absolute',
        bottom: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(15, 23, 42, 0.92)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 20,
        padding: '6px 18px',
        fontSize: '0.74rem',
        color: '#cbd5e1',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        backdropFilter: 'blur(8px)',
        zIndex: 20,
        boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
        pointerEvents: 'none'
      }}>
        <Sparkles size={13} color="#38bdf8" />
        <span>🖱️ Click & drag to rotate 360° and tilt towers • Scroll to zoom</span>
      </div>
    </div>
  );
}
