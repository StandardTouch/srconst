import React, { useState, useEffect, useMemo } from 'react';
import IsometricBlueprintBuilding from './components/IsometricBlueprintBuilding';
import FloorPlateViewer from './components/FloorPlateViewer';
import FlatInsideModal from './components/FlatInsideModal';
import BrochureUploadModal from './components/BrochureUploadModal';
import ErrorBoundary from './components/ErrorBoundary';
import { mockData } from './data/mockData';
import { 
  Building2, 
  Layers, 
  Search, 
  RotateCcw, 
  Sparkles, 
  FileText, 
  CheckCircle2, 
  Clock, 
  XCircle,
  LayoutGrid,
  Box,
  MapPin,
  ChevronDown,
  Upload,
  Filter
} from 'lucide-react';

export default function App() {
  const [allSites, setAllSites] = useState(mockData);
  const [selectedSiteId, setSelectedSiteId] = useState(mockData[0]?.id || 'site_imperial');
  const [loading, setLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Active site derived dynamically (guaranteeing valid blocks & flats)
  const siteData = useMemo(() => {
    const found = allSites.find(s => (s.id === selectedSiteId || s.name === selectedSiteId));
    if (found && found.blocks && found.blocks.length > 0) return found;
    return allSites.find(s => s.blocks && s.blocks.length > 0) || allSites[0] || mockData[0];
  }, [allSites, selectedSiteId]);

  // Selection states
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedFlat, setSelectedFlat] = useState(null);

  // UI modes
  const [mainView, setMainView] = useState('blueprint_view'); // 'blueprint_view' | 'matrix'

  // Filters
  const [filterBlock, setFilterBlock] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [filterFacing, setFilterFacing] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch real estate hierarchy from Frappe
  const fetchSiteData = () => {
    setLoading(true);
    if (window.frappe && window.frappe.call) {
      window.frappe.call({
        method: 'srconst.api.get_site_details',
        callback: function(r) {
          if (r.message && r.message.data && r.message.data.length > 0) {
            setAllSites(r.message.data);
            setSelectedSiteId(r.message.data[0].id || r.message.data[0].name);
          } else {
            setAllSites(mockData);
          }
          setLoading(false);
        },
        error: function() {
          setAllSites(mockData);
          setLoading(false);
        }
      });
    } else {
      // Standalone mode: try fetching from Frappe backend
      fetch('/api/method/srconst.api.get_site_details')
        .then(res => res.json())
        .then(r => {
          if (r.message && r.message.data && r.message.data.length > 0) {
            setAllSites(r.message.data);
            setSelectedSiteId(r.message.data[0].id || r.message.data[0].name);
          } else {
            setAllSites(mockData);
          }
        })
        .catch(() => {
          setAllSites(mockData);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  useEffect(() => {
    fetchSiteData();
  }, []);

  // Set default selected block whenever site changes
  useEffect(() => {
    if (siteData && siteData.blocks && siteData.blocks.length > 0) {
      setSelectedBlock(siteData.blocks[0]);
      setSelectedFloor(siteData.blocks[0].totalFloors > 4 ? 4 : 1);
      setSelectedFlat(null);
    }
  }, [siteData]);

  // Aggregate all flats across the current selected site
  const allFlats = useMemo(() => {
    if (!siteData || !siteData.blocks) return [];
    const list = [];
    siteData.blocks.forEach(b => {
      if (b.flats) {
        b.flats.forEach(f => {
          list.push({ ...f, blockName: b.name, blockPrefix: b.prefix });
        });
      }
    });
    return list;
  }, [siteData]);

  // Real-time inventory KPI metrics
  const stats = useMemo(() => {
    let total = allFlats.length;
    let available = 0;
    let inProcess = 0;
    let sold = 0;

    allFlats.forEach(f => {
      if (f.status === 'Available') available++;
      else if (f.status === 'In Process') inProcess++;
      else if (f.status === 'Sold') sold++;
    });

    const soldPercent = total > 0 ? Math.round(((sold + inProcess) / total) * 100) : 0;
    return { 
      total, 
      available, 
      inProcess, 
      sold, 
      soldPercent,
      availPercent: total > 0 ? Math.round((available / total) * 100) : 0,
      inProcPercent: total > 0 ? Math.round((inProcess / total) * 100) : 0
    };
  }, [allFlats]);

  // Filtered flats for matrix/list view
  const filteredFlats = useMemo(() => {
    return allFlats.filter(f => {
      if (filterBlock !== 'All' && f.blockName !== filterBlock) return false;
      if (filterStatus !== 'All' && f.status !== filterStatus) return false;
      if (filterType !== 'All' && !f.type.includes(filterType)) return false;
      if (filterFacing !== 'All' && f.facing !== filterFacing) return false;
      if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [allFlats, filterBlock, filterStatus, filterType, filterFacing, searchQuery]);

  // Handle flat status change and sync directly to Frappe DB / ERPNext
  const handleFlatStatusUpdate = (flatName, newStatus) => {
    setSelectedFlat(prev => prev && prev.name === flatName ? { ...prev, status: newStatus } : prev);
    setAllSites(prevSites => {
      return prevSites.map(site => {
        if (site.id !== siteData.id && site.name !== siteData.name) return site;
        return {
          ...site,
          blocks: site.blocks.map(b => ({
            ...b,
            flats: b.flats.map(f => f.name === flatName ? { ...f, status: newStatus } : f)
          }))
        };
      });
    });

    // Update in Frappe DB / ERPNext
    if (window.frappe && window.frappe.call) {
      window.frappe.call({
        method: 'srconst.api.update_flat_status',
        args: {
          flat_id: flatName,
          status: newStatus
        }
      });
    } else {
      fetch('/api/method/srconst.api.update_flat_status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flat_id: flatName, status: newStatus })
      }).catch(() => {});
    }
  };

  const formatPrice = (val) => {
    if (!val) return '₹-';
    return (val / 100000).toFixed(2) + ' L';
  };

  if (loading && !siteData) {
    return (
      <div className="graph-paper-grid" style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16
      }}>
        <div style={{
          width: 44,
          height: 44,
          border: '3px solid #000000',
          borderTopColor: '#ff5b29',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <div style={{
          fontFamily: "var(--font-geist-mono, monospace)",
          fontSize: '13px',
          fontWeight: 700,
          color: '#000000'
        }}>
          // INITIALIZING ARCHITECTURAL BLUEPRINT...
        </div>
      </div>
    );
  }

  return (
    <div className="graph-paper-grid" style={{
      minHeight: '100vh',
      color: '#000000',
      fontFamily: "var(--font-geist, sans-serif)",
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Top Timescale Engineering Navigation Bar */}
      <header style={{
        background: '#fafafa',
        borderBottom: '1px solid #000000',
        padding: '10px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Logo Brand Mark */}
          <div style={{
            width: 36,
            height: 36,
            border: '1.5px solid #000000',
            borderRadius: 8,
            background: '#ff5b29',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '2px 2px 0px #000000'
          }}>
            <Building2 size={20} color="#fafafa" />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: '#000000'
              }}>
                SR Construction
              </h1>

              {/* Dynamic Site Picker Pill */}
              <div style={{ position: 'relative' }}>
                <select
                  value={siteData?.id || siteData?.name}
                  onChange={(e) => {
                    setSelectedSiteId(e.target.value);
                  }}
                  style={{
                    appearance: 'none',
                    background: '#ffffff',
                    border: '1px solid #000000',
                    color: '#000000',
                    padding: '4px 28px 4px 10px',
                    borderRadius: 9999,
                    fontSize: '12px',
                    fontFamily: "var(--font-geist-mono, monospace)",
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '2px 2px 0px #000000',
                    outline: 'none'
                  }}
                >
                  {allSites.map(s => (
                    <option key={s.id || s.name} value={s.id || s.name} style={{ background: '#fff', color: '#000' }}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} color="#000000" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </div>

            <div style={{
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: '11px',
              color: '#6c6c6c',
              marginTop: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              <MapPin size={11} color="#ff5b29" />
              <span>{siteData?.location || 'Prime Waterfront Promenade'}</span>
            </div>
          </div>
        </div>

        {/* Center: View Switcher */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setMainView('blueprint_view')}
            style={{
              background: mainView === 'blueprint_view' ? '#000000' : '#ffffff',
              border: '1px solid #000000',
              color: mainView === 'blueprint_view' ? '#fafafa' : '#000000',
              padding: '6px 16px',
              borderRadius: 9999,
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              boxShadow: mainView === 'blueprint_view' ? '2px 2px 0px #ff5b29' : '2px 2px 0px #000000',
              transition: 'all 0.1s ease'
            }}
          >
            <Box size={14} />
            Interactive Blueprint
          </button>

          <button
            onClick={() => setMainView('matrix')}
            style={{
              background: mainView === 'matrix' ? '#000000' : '#ffffff',
              border: '1px solid #000000',
              color: mainView === 'matrix' ? '#fafafa' : '#000000',
              padding: '6px 16px',
              borderRadius: 9999,
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              boxShadow: mainView === 'matrix' ? '2px 2px 0px #ff5b29' : '2px 2px 0px #000000',
              transition: 'all 0.1s ease'
            }}
          >
            <LayoutGrid size={14} />
            All Units Matrix
          </button>
        </div>

        {/* Right: Ingest Brochure CTA */}
        <div>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="timescale-btn-primary"
          >
            <Upload size={14} />
            + Ingest Brochure (New Site)
          </button>
        </div>
      </header>

      {/* Timescale Stats Banner Card (Section 134 of DESIGN.md) */}
      <section style={{ padding: '12px 20px 8px 20px' }}>
        <div style={{
          background: '#fafafa',
          border: '1px solid #000000',
          borderRadius: 12,
          boxShadow: '5px 5px 0px #000000',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          overflow: 'hidden'
        }}>
          {/* Stat 1: Total Inventory */}
          <div style={{
            padding: '12px 18px',
            borderRight: '1px solid #000000'
          }}>
            <div style={{
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: '36px',
              fontWeight: 700,
              lineHeight: 1.1,
              color: '#ff5b29'
            }}>
              {stats.total}
            </div>
            <div style={{
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: '11px',
              fontWeight: 700,
              color: '#000000',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginTop: 4
            }}>
              TOTAL FLATS // {siteData?.blocks?.length || 0} TOWERS
            </div>
          </div>

          {/* Stat 2: Available Ready */}
          <div style={{
            padding: '12px 18px',
            borderRight: '1px solid #000000'
          }}>
            <div style={{
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: '36px',
              fontWeight: 700,
              lineHeight: 1.1,
              color: '#059669'
            }}>
              {stats.available}
            </div>
            <div style={{
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: '11px',
              fontWeight: 700,
              color: '#000000',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginTop: 4
            }}>
              AVAILABLE // {stats.availPercent}% READY TO BOOK
            </div>
          </div>

          {/* Stat 3: Token / In Process */}
          <div style={{
            padding: '12px 18px',
            borderRight: '1px solid #000000'
          }}>
            <div style={{
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: '36px',
              fontWeight: 700,
              lineHeight: 1.1,
              color: '#d97706'
            }}>
              {stats.inProcess}
            </div>
            <div style={{
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: '11px',
              fontWeight: 700,
              color: '#000000',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginTop: 4
            }}>
              IN PROCESS // {stats.inProcPercent}% TOKEN HELD
            </div>
          </div>

          {/* Stat 4: Sold Out & Booked Rate */}
          <div style={{
            padding: '12px 18px'
          }}>
            <div style={{
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: '36px',
              fontWeight: 700,
              lineHeight: 1.1,
              color: '#000000'
            }}>
              {stats.soldPercent}%
            </div>
            <div style={{
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: '11px',
              fontWeight: 700,
              color: '#000000',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginTop: 4
            }}>
              OCCUPIED // {stats.sold} FLATS ALLOTTED
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main style={{ padding: '8px 20px 20px 20px' }}>
        {mainView === 'blueprint_view' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: selectedBlock ? '1.15fr 1fr' : '1fr',
            gap: 16,
            minHeight: '75vh'
          }}>
            {/* Left: Isometric Technical Blueprint Building Model (Matching Image 1) */}
            <div style={{ height: '100%' }}>
              <IsometricBlueprintBuilding
                site={siteData}
                selectedBlock={selectedBlock}
                onSelectBlock={(b) => setSelectedBlock(b)}
                selectedFloor={selectedFloor}
                onSelectFloor={(fl) => setSelectedFloor(fl)}
              />
            </div>

            {/* Right: Floor Plate Viewer & Floor Ribbon */}
            {selectedBlock && (
              <div style={{ height: '100%', overflowY: 'auto' }}>
                {/* Clean Timescale Floor Picker Ribbon */}
                <div style={{
                  display: 'flex',
                  gap: 6,
                  overflowX: 'auto',
                  padding: '4px 2px 10px 2px',
                  marginBottom: 10,
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}>
                  {Array.from({ length: selectedBlock.totalFloors || 14 }, (_, i) => i + 1).map(fl => {
                    const isSelected = selectedFloor === fl;
                    return (
                      <button
                        key={fl}
                        onClick={() => setSelectedFloor(fl)}
                        style={{
                          flexShrink: 0,
                          fontFamily: "var(--font-geist-mono, monospace)",
                          background: isSelected ? '#000000' : '#ffffff',
                          border: '1px solid #000000',
                          color: isSelected ? '#fafafa' : '#000000',
                          padding: '5px 12px',
                          borderRadius: 9999,
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          boxShadow: isSelected ? '2px 2px 0px #ff5b29' : '2px 2px 0px #000000',
                          transition: 'all 0.1s ease'
                        }}
                      >
                        L{String(fl).padStart(2, '0')}
                      </button>
                    );
                  })}
                </div>

                <FloorPlateViewer
                  site={siteData}
                  block={selectedBlock}
                  floorNumber={selectedFloor || 1}
                  flats={selectedBlock.flats || []}
                  onSelectFlat={(flat) => setSelectedFlat(flat)}
                  selectedFlat={selectedFlat}
                />
              </div>
            )}
          </div>
        )}

        {/* View Mode 2: Detailed Flat Grid Matrix */}
        {mainView === 'matrix' && (
          <div style={{
            background: '#fafafa',
            border: '1px solid #000000',
            borderRadius: 12,
            boxShadow: '5px 5px 0px #000000',
            padding: 24
          }}>
            {/* Search & Filter Header */}
            <div style={{
              display: 'flex',
              gap: 12,
              marginBottom: 20,
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #000000',
              paddingBottom: 16
            }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#ffffff',
                  border: '1px solid #000000',
                  borderRadius: 4,
                  padding: '6px 12px',
                  width: 260
                }}>
                  <Search size={14} color="#6c6c6c" style={{ marginRight: 8 }} />
                  <input
                    type="text"
                    placeholder="Search unit by number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#000000',
                      outline: 'none',
                      fontSize: '13px',
                      fontFamily: "var(--font-geist, sans-serif)",
                      width: '100%'
                    }}
                  />
                </div>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #000000',
                    color: '#000000',
                    padding: '6px 12px',
                    borderRadius: 4,
                    fontSize: '12px',
                    fontFamily: "var(--font-geist-mono, monospace)",
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <option value="All">All Statuses</option>
                  <option value="Available">Available</option>
                  <option value="In Process">In Process</option>
                  <option value="Sold">Sold</option>
                </select>

                <select
                  value={filterBlock}
                  onChange={(e) => setFilterBlock(e.target.value)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #000000',
                    color: '#000000',
                    padding: '6px 12px',
                    borderRadius: 4,
                    fontSize: '12px',
                    fontFamily: "var(--font-geist-mono, monospace)",
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <option value="All">All Towers</option>
                  {siteData?.blocks?.map(b => (
                    <option key={b.name} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div style={{
                fontFamily: "var(--font-geist-mono, monospace)",
                fontSize: '12px',
                color: '#6c6c6c',
                fontWeight: 600
              }}>
                SHOWING {filteredFlats.length} OF {allFlats.length} UNITS
              </div>
            </div>

            {/* Flat Cards Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16
            }}>
              {filteredFlats.map(flat => (
                <div
                  key={flat.name}
                  onClick={() => setSelectedFlat(flat)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #000000',
                    borderRadius: 8,
                    padding: 16,
                    cursor: 'pointer',
                    boxShadow: '3px 3px 0px #000000',
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translate(-1px, -1px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translate(0, 0)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{
                        fontFamily: "var(--font-geist-mono, monospace)",
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        color: '#000000'
                      }}>
                        {flat.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6c6c6c' }}>{flat.blockName} • {flat.floor}</div>
                    </div>
                    <span style={{
                      fontFamily: "var(--font-geist-mono, monospace)",
                      background: flat.status === 'Available' ? '#ffffff' : flat.status === 'In Process' ? '#f5ff80' : '#000000',
                      color: flat.status === 'Sold' ? '#ffffff' : '#000000',
                      border: '1px solid #000000',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4
                    }}>
                      {flat.status}
                    </span>
                  </div>

                  <div style={{ margin: '12px 0', fontSize: '13px', color: '#6c6c6c', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{flat.type} • {flat.facing}</span>
                    <span><b>{flat.area} sqft</b></span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #000000', paddingTop: 10 }}>
                    <div style={{
                      fontFamily: "var(--font-geist-mono, monospace)",
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      color: '#000000'
                    }}>
                      {formatPrice(flat.price)}
                    </div>
                    <button style={{
                      background: '#000000',
                      border: '1px solid #000000',
                      color: '#fafafa',
                      borderRadius: 9999,
                      padding: '5px 12px',
                      fontSize: '11px',
                      fontFamily: "var(--font-geist-mono, monospace)",
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}>
                      Inspect →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Flat Inside Real-Time Modal */}
      {selectedFlat && (
        <FlatInsideModal
          flat={selectedFlat}
          onClose={() => setSelectedFlat(null)}
          onStatusChange={handleFlatStatusUpdate}
        />
      )}

      {/* Dynamic Brochure Ingestion Modal */}
      <BrochureUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSiteCreated={(newSite) => {
          setAllSites(prev => [newSite, ...prev]);
          setSelectedSiteId(newSite.id || newSite.name);
          if (newSite.blocks && newSite.blocks.length > 0) {
            setSelectedBlock(newSite.blocks[0]);
            setSelectedFloor(newSite.blocks[0].totalFloors > 4 ? 4 : 1);
          }
        }}
      />
    </div>
  );
}
