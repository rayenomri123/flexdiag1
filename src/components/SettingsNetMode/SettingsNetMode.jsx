import React, { useState, useRef, useEffect } from 'react';
import './SettingsNetMode.css';
import { VscChevronDown } from 'react-icons/vsc';

const SettingsNetMode = ({ netMode, setNetMode, currentNetMode, setCurrentNetMode }) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const modes = ['dynamic', 'static', 'auto-ip'];

  return (
    <div className='netmode-container'>
      <div className="netmode-title">Network mode</div>

      <button
        className={`netmode-selector-btn ${open ? 'open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {currentNetMode || 'Select mode'}
        <VscChevronDown className='netmode-selector-btn-chev' />
      </button>

      {open && (
        <ul className="netmode-dropdown" role="listbox" ref={dropdownRef}>
          {modes.map((netMode) => (
            <li
              key={netMode}
              className="netmode-dropdown-item"
              role="option"
              onClick={() => {
                setCurrentNetMode(netMode);
                setNetMode(netMode);
                setOpen(false);
              }}
            >
              {netMode}
            </li>
          ))}
        </ul>
      )}

      <div className="netmode-description">
        This mode will be used to establish a connection with ECU.
      </div>
    </div>
  );
};

export default SettingsNetMode;