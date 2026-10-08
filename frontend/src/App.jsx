import React, { useState, useMemo, useEffect } from 'react';
import { mockData } from './data/mockData';

const formatCurrency = (amount) => {
  if (!amount) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

const FlatCard = ({ flat }) => {
  const statusClass = (flat.status || '').replace(' ', '-');
  
  return (
    <div className={`flat-card status-${statusClass}`}>
      <div className="flat-header">
        <div className="flat-name">{flat.name}</div>
        <div className="flat-status">{flat.status}</div>
      </div>
      
      <div className="flat-details">
        <div className="detail-item">
          <span className="detail-label">Type</span>
          <span className="detail-value">{flat.type || '-'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Facing</span>
          <span className="detail-value">{flat.facing || '-'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Area</span>
          <span className="detail-value">{flat.area ? `${flat.area} Sq Ft` : '-'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Floor</span>
          <span className="detail-value">{flat.floor || '-'}</span>
        </div>
      </div>
      
      <div className="flat-price">
        {formatCurrency(flat.price)}
      </div>
    </div>
  );
};

const SimplifiedSeat = ({ flat }) => {
  const statusClass = (flat.status || '').replace(' ', '-');
  
  return (
    <div className={`seat-box seat-${statusClass}`} title={`${flat.name} - ${flat.status}\n${flat.type || ''} | ${formatCurrency(flat.price)}`}>
      {flat.name.split('-').pop()}
    </div>
  );
};

const Dashboard = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [filterSite, setFilterSite] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [viewMode, setViewMode] = useState('simplified'); // 'detailed' | 'simplified'
  
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchFlats = () => {
    setLoading(true);
    if (window.frappe && window.frappe.call) {
      window.frappe.call({
        method: 'frappe.client.get_list',
        args: {
          doctype: 'Flat',
          fields: ['name', 'flat_number', 'building', 'block', 'floor', 'status', 'flat_type as type', 'facing', 'area_sqft as area', 'base_price as price'],
          limit_page_length: 0
        },
        callback: function(r) {
          if (r.message && r.message.length > 0) {
            // Transform list into hierarchy: Site -> Block -> Flats
            const sitesMap = {};
            r.message.forEach(flat => {
              const buildingName = flat.building || 'Unassigned Site';
              const blockName = flat.block || 'Main Block';
              
              if (!sitesMap[buildingName]) {
                sitesMap[buildingName] = { name: buildingName, blocksMap: {} };
              }
              if (!sitesMap[buildingName].blocksMap[blockName]) {
                sitesMap[buildingName].blocksMap[blockName] = { name: blockName, flats: [] };
              }
              
              // Use flat_number for display if available, else name
              const flatName = flat.flat_number || flat.name;
              
              sitesMap[buildingName].blocksMap[blockName].flats.push({
                ...flat,
                name: flatName
              });
            });
            
            // Convert maps to arrays
            const formattedData = Object.values(sitesMap).map(site => ({
              name: site.name,
              blocks: Object.values(site.blocksMap)
            }));
            
            setData(formattedData);
          } else {
            console.log('No flats found in Frappe database. Using fallback mock data.');
            setData(mockData);
          }
          setLoading(false);
        },
        error: function(r) {
          console.log('API Error or DocType not found. Falling back to mock data.');
          setData(mockData);
          setLoading(false);
        }
      });
    } else {
      // Fallback to mock data when developing locally outside Frappe
      console.log('Frappe not found. Using mock data.');
      setData(mockData);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlats();
  }, [refreshKey]);

  // Auto-refresh every 1 minute
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Compute stats
  const stats = useMemo(() => {
    let total = 0;
    let empty = 0;
    let process = 0;
    let sold = 0;

    data.forEach(site => {
      site.blocks.forEach(block => {
        block.flats.forEach(flat => {
          total++;
          if (flat.status === 'Empty') empty++;
          if (flat.status === 'In Process') process++;
          if (flat.status === 'Sold') sold++;
        });
      });
    });

    return { total, empty, process, sold };
  }, [data]);

  if (loading && data.length === 0) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <h3>Loading Real Estate Data...</h3>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <div className="header-title">
          <h1>Real Estate Overview</h1>
          <p>Live inventory status across all sites and blocks</p>
        </div>
        <div className="view-toggle">
          <button 
            className={`view-btn ${viewMode === 'detailed' ? 'active' : ''}`}
            onClick={() => setViewMode('detailed')}
          >
            Detailed View
          </button>
          <button 
            className={`view-btn ${viewMode === 'simplified' ? 'active' : ''}`}
            onClick={() => setViewMode('simplified')}
          >
            Simplified View
          </button>
        </div>
      </header>

      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-title">Total Inventory</div>
          <div className="summary-value">{stats.total}</div>
        </div>
        <div className="summary-card" style={{ borderLeft: '4px solid var(--status-empty)' }}>
          <div className="summary-title" style={{ color: 'var(--status-empty)' }}>Available</div>
          <div className="summary-value">{stats.empty}</div>
        </div>
        <div className="summary-card" style={{ borderLeft: '4px solid var(--status-process)' }}>
          <div className="summary-title" style={{ color: 'var(--status-process)' }}>In Process</div>
          <div className="summary-value">{stats.process}</div>
        </div>
        <div className="summary-card" style={{ borderLeft: '4px solid var(--status-sold)' }}>
          <div className="summary-title" style={{ color: 'var(--status-sold)' }}>Sold</div>
          <div className="summary-value">{stats.sold}</div>
        </div>
      </div>

      <div className="filters-section">
        <select 
          className="filter-select"
          value={filterSite}
          onChange={(e) => setFilterSite(e.target.value)}
        >
          <option value="All">All Sites</option>
          {data.map(site => <option key={site.name} value={site.name}>{site.name}</option>)}
        </select>
        
        <select 
          className="filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Empty">Available</option>
          <option value="In Process">In Process</option>
          <option value="Sold">Sold</option>
        </select>
        
        <select 
          className="filter-select"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="All">All Types</option>
          <option value="1BHK">1BHK</option>
          <option value="2BHK">2BHK</option>
          <option value="3BHK">3BHK</option>
          <option value="4BHK">4BHK</option>
        </select>
      </div>

      {viewMode === 'simplified' && (
        <div className="simplified-legend">
          <div className="legend-item">
            <div className="legend-box legend-Empty"></div>
            <span>Available</span>
          </div>
          <div className="legend-item">
            <div className="legend-box legend-In-Process"></div>
            <span>In Process</span>
          </div>
          <div className="legend-item">
            <div className="legend-box legend-Sold"></div>
            <span>Sold</span>
          </div>
        </div>
      )}

      <main>
        {data
          .filter(site => filterSite === 'All' || site.name === filterSite)
          .map(site => (
          <div key={site.name} className="site-section">
            <h2 className="site-title">{site.name}</h2>
            
            {site.blocks.map(block => {
              // Pre-filter flats for this block
              const filteredFlats = block.flats.filter(flat => 
                (filterStatus === 'All' || flat.status === filterStatus) &&
                (filterType === 'All' || flat.type === filterType)
              );

              if (filteredFlats.length === 0) return null;

              // Group flats by floor
              const flatsByFloor = filteredFlats.reduce((acc, flat) => {
                const floorName = flat.floor || 'Unknown Floor';
                if (!acc[floorName]) acc[floorName] = [];
                acc[floorName].push(flat);
                return acc;
              }, {});

              const floorOrder = ["Ground Floor", "First Floor", "Second Floor", "Third Floor", "Fourth Floor", "Fifth Floor", "Sixth Floor", "Seventh Floor", "Eighth Floor", "Ninth Floor", "Tenth Floor"];
              
              const sortedFloors = Object.keys(flatsByFloor).sort((a, b) => {
                 const indexA = floorOrder.indexOf(a);
                 const indexB = floorOrder.indexOf(b);
                 // Sort descending (top floor first)
                 return (indexB === -1 ? 99 : indexB) - (indexA === -1 ? 99 : indexA);
              });

              return (
                <div key={block.name} className="block-section">
                  <h3 className="block-title">{block.name}</h3>
                  
                  {sortedFloors.map(floor => (
                    <div key={floor} className="floor-section">
                      <h4 className="floor-title">{floor}</h4>
                      
                      {viewMode === 'detailed' ? (
                        <div className="flats-grid-detailed">
                          {flatsByFloor[floor].map(flat => (
                            <FlatCard key={flat.name} flat={flat} />
                          ))}
                        </div>
                      ) : (
                        <div className="flats-grid-simplified">
                          {flatsByFloor[floor].map(flat => (
                            <SimplifiedSeat key={flat.name} flat={flat} />
                          ))}
                        </div>
                      )}
                      
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </main>
    </div>
  );
};

export default Dashboard;
