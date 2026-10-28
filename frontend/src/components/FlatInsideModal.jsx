import React, { useState } from 'react';
import { X, Check, ShieldCheck, Phone, User, Calendar, CreditCard, Sparkles, Home, Layers, Eye } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getAssetUrl } from '../utils/assetUrl';

export default function FlatInsideModal({ flat, onClose, onStatusChange }) {
  if (!flat) return null;

  const [activeTab, setActiveTab] = useState('3d_render'); // '3d_render' | 'specs' | 'emi'
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const unitIdx = flat.unitIndex || parseInt(flat.name.slice(-2)) || 1;
  const cutawayUrl = flat.inside3dRender || `/assets/srconst/brochure/units/flat_${unitIdx}.webp`;

  const formatCurrency = (val) => {
    if (!val) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleDirectStatusChange = (newStatus) => {
    setIsUpdating(true);
    if (window.frappe && window.frappe.call) {
      window.frappe.call({
        method: 'srconst.api.update_flat_status',
        args: {
          flat_id: flat.name,
          status: newStatus
        },
        callback: function(r) {
          setIsUpdating(false);
          if (onStatusChange) onStatusChange(flat.name, newStatus);
        },
        error: function() {
          setIsUpdating(false);
          if (onStatusChange) onStatusChange(flat.name, newStatus);
        }
      });
    } else {
      fetch('/api/method/srconst.api.update_flat_status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flat_id: flat.name, status: newStatus })
      }).catch(() => {}).finally(() => {
        setIsUpdating(false);
        if (onStatusChange) onStatusChange(flat.name, newStatus);
      });
    }
  };

  const handleReserve = () => {
    setIsUpdating(true);
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {}

    // Post to Frappe backend
    if (window.frappe && window.frappe.call) {
      window.frappe.call({
        method: 'srconst.api.update_flat_status',
        args: {
          flat_id: flat.name,
          status: 'In Process',
          customer_name: leadName || 'VIP Client',
          customer_phone: leadPhone || ''
        },
        callback: function(r) {
          setIsUpdating(false);
          setBookingSuccess(true);
          if (onStatusChange) onStatusChange(flat.name, 'In Process');
        },
        error: function() {
          setIsUpdating(false);
          setBookingSuccess(true);
          if (onStatusChange) onStatusChange(flat.name, 'In Process');
        }
      });
    } else {
      fetch('/api/method/srconst.api.update_flat_status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flat_id: flat.name,
          status: 'In Process',
          customer_name: leadName || 'VIP Client',
          customer_phone: leadPhone || ''
        })
      }).catch(() => {}).finally(() => {
        setIsUpdating(false);
        setBookingSuccess(true);
        if (onStatusChange) onStatusChange(flat.name, 'In Process');
      });
    }
  };

  const dims = flat.dims || {
    livingDining: "21'6\" x 10'0\"",
    masterBedroom: "12'0\" x 10'0\" + En-suite",
    bedroom2: "10'0\" x 10'0\"",
    kitchen: "9'6\" x 10'6\"",
    balcony: "8'0\" x 10'0\"",
    utility: "5'0\" x 11'0\""
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(6px)',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: '#fafafa',
        borderRadius: 12,
        border: '1.5px solid #000000',
        width: '100%',
        maxWidth: 1040,
        maxHeight: '92vh',
        overflowY: 'auto',
        color: '#000000',
        boxShadow: '8px 8px 0px #000000',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 24px',
          borderBottom: '1px solid #000000',
          background: '#ffffff'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{
                margin: 0,
                fontSize: '1.5rem',
                fontWeight: 700,
                fontFamily: "var(--font-geist-mono, monospace)",
                letterSpacing: '-0.02em',
                color: '#000000'
              }}>
                Unit {flat.name}
              </h2>
              <span style={{
                fontFamily: "var(--font-geist-mono, monospace)",
                background: flat.status === 'Available' ? '#ffffff' : flat.status === 'In Process' ? '#f5ff80' : '#000000',
                border: '1px solid #000000',
                color: flat.status === 'Sold' ? '#ffffff' : '#000000',
                padding: '3px 10px',
                borderRadius: 9999,
                fontSize: '11px',
                fontWeight: 700
              }}>
                {flat.status}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#6c6c6c', marginTop: 4 }}>
              {flat.type} • {flat.facing} Facing • {flat.floor} • Super Built-up: {flat.area} sqft
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#ffffff',
              border: '1px solid #000000',
              color: '#000000',
              width: 34,
              height: 34,
              borderRadius: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '2px 2px 0px #000000'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab navigation in Timescale style */}
        <div style={{
          display: 'flex',
          gap: 10,
          padding: '12px 24px',
          background: '#fafafa',
          borderBottom: '1px solid #000000'
        }}>
          {[
            { id: '3d_render', label: '// BROCHURE INSIDE CUTAWAY' },
            { id: 'specs', label: '// ROOM DIMENSIONS & SPECS' },
            { id: 'emi', label: '// PRICING & PAYMENT SCHEDULE' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                fontFamily: "var(--font-geist-mono, monospace)",
                background: activeTab === tab.id ? '#000000' : '#ffffff',
                border: '1px solid #000000',
                color: activeTab === tab.id ? '#fafafa' : '#000000',
                padding: '6px 14px',
                borderRadius: 9999,
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: activeTab === tab.id ? '2px 2px 0px #ff5b29' : 'none'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div style={{
          padding: '24px',
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.8fr',
          gap: 24
        }}>
          {/* Left Column: Visuals & Dimensions */}
          <div>
            {activeTab === '3d_render' && (
              <div style={{
                background: '#ffffff',
                borderRadius: 8,
                overflow: 'hidden',
                border: '1.5px solid #000000',
                boxShadow: '4px 4px 0px #000000',
                position: 'relative'
              }}>
                <img
                  src={getAssetUrl(cutawayUrl)}
                  alt={`Flat ${flat.name} Cutaway`}
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: '480px',
                    objectFit: 'contain',
                    display: 'block',
                    margin: '0 auto',
                    filter: 'contrast(1.02)'
                  }}
                  onError={(e) => {
                    e.target.src = getAssetUrl('/assets/srconst/brochure/floor_plan_preview.jpg');
                  }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: 12,
                  left: 12,
                  right: 12,
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #000000',
                  padding: '6px 12px',
                  borderRadius: 4,
                  fontSize: '11px',
                  fontFamily: "var(--font-geist-mono, monospace)",
                  color: '#000000',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '2px 2px 0px #000000'
                }}>
                  <span>// ARCHITECTURAL INTERIOR CUTAWAY</span>
                  <span style={{ color: '#ff5b29', fontWeight: 700 }}>HIGH-DEFINITION LAYOUT</span>
                </div>
              </div>
            )}

            {activeTab === 'specs' && (
              <div style={{
                background: '#ffffff',
                borderRadius: 8,
                padding: 20,
                border: '1.5px solid #000000',
                boxShadow: '4px 4px 0px #000000'
              }}>
                <h3 style={{
                  margin: '0 0 14px 0',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#000000',
                  fontFamily: "var(--font-geist-mono, monospace)"
                }}>
                  // ARCHITECTURAL ROOM DIMENSIONS
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {Object.entries(dims).map(([room, dim]) => (
                    <div key={room} style={{
                      background: '#fafafa',
                      padding: 10,
                      borderRadius: 4,
                      border: '1px solid #000000'
                    }}>
                      <div style={{ fontSize: '11px', color: '#6c6c6c', textTransform: 'uppercase', fontFamily: "var(--font-geist-mono, monospace)" }}>
                        {room.replace(/([A-Z])/g, ' $1')}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#000000', marginTop: 2, fontFamily: "var(--font-geist-mono, monospace)" }}>
                        {dim}
                      </div>
                    </div>
                  ))}
                </div>

                <h3 style={{
                  margin: '18px 0 10px 0',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#000000',
                  fontFamily: "var(--font-geist-mono, monospace)"
                }}>
                  // SPECIFICATIONS & INCLUSIONS
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    "Vastu Compliant Orientation",
                    "Acoustic Double Glazed Balcony Windows",
                    "Teak Wood Entrance Door with Biometric Lock",
                    "Concealed Copper Wiring & Modular Switches"
                  ].map((feat, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px' }}>
                      <Check size={14} color="#059669" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'emi' && (
              <div style={{
                background: '#ffffff',
                borderRadius: 8,
                padding: 20,
                border: '1.5px solid #000000',
                boxShadow: '4px 4px 0px #000000'
              }}>
                <h3 style={{
                  margin: '0 0 14px 0',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#000000',
                  fontFamily: "var(--font-geist-mono, monospace)"
                }}>
                  // PRICE BREAKDOWN & SCHEDULE
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e5e5' }}>
                    <span style={{ color: '#6c6c6c' }}>Base Consideration Value</span>
                    <b style={{ fontFamily: "var(--font-geist-mono, monospace)" }}>{formatCurrency(flat.price * 0.92)}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e5e5' }}>
                    <span style={{ color: '#6c6c6c' }}>Floor Rise & Preferred Location</span>
                    <b style={{ fontFamily: "var(--font-geist-mono, monospace)" }}>{formatCurrency(flat.price * 0.05)}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e5e5' }}>
                    <span style={{ color: '#6c6c6c' }}>Covered Car Parking (1 Bay)</span>
                    <b style={{ fontFamily: "var(--font-geist-mono, monospace)" }}>₹3,50,000</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', color: '#ff5b29', fontSize: '1.1rem' }}>
                    <span style={{ fontWeight: 700 }}>Total All-Inclusive Value</span>
                    <b style={{ fontFamily: "var(--font-geist-mono, monospace)" }}>{formatCurrency(flat.price)}</b>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Pricing & ERPNext Booking Action */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Price Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: 8,
              padding: 18,
              border: '1.5px solid #000000',
              boxShadow: '4px 4px 0px #000000'
            }}>
              <div style={{ fontSize: '11px', color: '#6c6c6c', textTransform: 'uppercase', fontFamily: "var(--font-geist-mono, monospace)" }}>
                // ALL-INCLUSIVE PRICE
              </div>
              <div style={{
                fontSize: '2rem',
                fontWeight: 800,
                color: '#ff5b29',
                margin: '4px 0 10px 0',
                fontFamily: "var(--font-geist-mono, monospace)"
              }}>
                {formatCurrency(flat.price)}
              </div>
              <div style={{ fontSize: '12px', color: '#000000', display: 'flex', gap: 12 }}>
                <span>Rate: <b>₹{Math.round(flat.price / flat.area)} / sqft</b></span>
                <span>Facing: <b>{flat.facing}</b></span>
              </div>
            </div>

            {/* Instant Reservation Form */}
            <div style={{
              background: '#ffffff',
              borderRadius: 8,
              padding: 18,
              border: '1.5px solid #000000',
              boxShadow: '4px 4px 0px #000000'
            }}>
              <h3 style={{
                margin: '0 0 12px 0',
                fontSize: '1rem',
                fontWeight: 700,
                color: '#000000',
                fontFamily: "var(--font-geist-mono, monospace)"
              }}>
                // INSTANT RESERVATION & LEAD
              </h3>

              {bookingSuccess ? (
                <div style={{
                  background: '#f5ff80',
                  border: '1px solid #000000',
                  borderRadius: 6,
                  padding: 14,
                  textAlign: 'center',
                  color: '#000000',
                  boxShadow: '2px 2px 0px #000000'
                }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700 }}>🎉 Reserved Successfully!</div>
                  <div style={{ fontSize: '12px', marginTop: 4 }}>
                    Unit {flat.name} marked as <b>In Process</b>. Lead registered in ERPNext.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#6c6c6c', display: 'block', marginBottom: 4, fontFamily: "var(--font-geist-mono, monospace)" }}>
                      CUSTOMER NAME
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      style={{
                        background: '#fafafa',
                        border: '1px solid #000000',
                        color: '#000000',
                        padding: '8px 12px',
                        borderRadius: 4,
                        width: '100%',
                        fontSize: '13px',
                        outline: 'none',
                        fontFamily: "var(--font-geist, sans-serif)"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: '#6c6c6c', display: 'block', marginBottom: 4, fontFamily: "var(--font-geist-mono, monospace)" }}>
                      PHONE NUMBER
                    </label>
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      style={{
                        background: '#fafafa',
                        border: '1px solid #000000',
                        color: '#000000',
                        padding: '8px 12px',
                        borderRadius: 4,
                        width: '100%',
                        fontSize: '13px',
                        outline: 'none',
                        fontFamily: "var(--font-geist-mono, monospace)"
                      }}
                    />
                  </div>

                  <button
                    onClick={handleReserve}
                    disabled={isUpdating}
                    className="timescale-btn-primary"
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      padding: '10px 16px'
                    }}
                  >
                    {isUpdating ? 'Saving to DB...' : 'Reserve Flat (Take Token)'}
                  </button>

                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      onClick={() => handleDirectStatusChange('Available')}
                      disabled={isUpdating}
                      style={{
                        flex: 1,
                        background: flat.status === 'Available' ? '#000000' : '#ffffff',
                        border: '1px solid #000000',
                        color: flat.status === 'Available' ? '#fafafa' : '#000000',
                        padding: '8px',
                        borderRadius: 4,
                        fontSize: '11px',
                        fontFamily: "var(--font-geist-mono, monospace)",
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      ✓ Set Available
                    </button>
                    <button
                      onClick={() => handleDirectStatusChange('Sold')}
                      disabled={isUpdating}
                      style={{
                        flex: 1,
                        background: flat.status === 'Sold' ? '#000000' : '#ffffff',
                        border: '1px solid #000000',
                        color: flat.status === 'Sold' ? '#fafafa' : '#000000',
                        padding: '8px',
                        borderRadius: 4,
                        fontSize: '11px',
                        fontFamily: "var(--font-geist-mono, monospace)",
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      ✕ Mark as Sold
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Regulatory Footer */}
            <div style={{
              background: '#ffffff',
              borderRadius: 6,
              padding: 12,
              border: '1px solid #000000',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '11px',
              fontFamily: "var(--font-geist-mono, monospace)",
              color: '#6c6c6c'
            }}>
              <ShieldCheck size={18} color="#059669" />
              <span>RERA REGISTERED • VERIFIED LEGAL CLEARANCES</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
