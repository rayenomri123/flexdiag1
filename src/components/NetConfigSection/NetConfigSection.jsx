import React, { useState, useEffect } from 'react';
import './NetConfigSection.css';
import { VscSaveAll, VscChevronDown, VscSync } from 'react-icons/vsc';

const ServerConfigSection = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [interfaces, setInterfaces] = useState([]);

  // Single row config state
  const [selectedInterface, setSelectedInterface] = useState('');
  const [ipHost, setIpHost] = useState('');
  const [subnet, setSubnet] = useState('');
  const [poolVal1, setPoolVal1] = useState('');
  const [poolVal2, setPoolVal2] = useState('');

  // action logs: only hold one at a time
  const [log, setLog] = useState(null);
  const addLog = (message, valid) => {
    setLog({ message, valid });
    setTimeout(() => setLog(null), 2000);
  };

  // Fetch network interfaces + saved config
  useEffect(() => {
    (async () => {
      try {
        // load available interfaces
        const ifs = await window.networkAPI.getNetworkInterfaces();
        const names = Object.keys(ifs);
        setInterfaces(names);

        // load saved settings (only one row)
        const rows = await window.dbAPI.fetchNetworkSetup();
        if (rows.length) {
          const saved = rows[0];
          const iface = saved.interface;
          setSelectedInterface(iface);
          setIpHost(saved.ip_host);
          setSubnet(saved.subnet);
          setPoolVal1(saved.pool_val1);
          setPoolVal2(saved.pool_val2);
        } else if (names.length) {
          // no saved config: default to first iface
          setSelectedInterface(names[0]);
        }
      } catch (e) {
        console.error('Initialization failed:', e);
        addLog('Initialization failed', false);
      }
    })();
  }, []);

  // dropdown handlers
  const toggleDropdown = () => setIsDropdownOpen(o => !o);
  const selectInterface = iface => {
    setSelectedInterface(iface);
    setIsDropdownOpen(false);
  };
  useEffect(() => {
    const handler = e => {
      if (!e.target.closest('.interface-dropdown')) setIsDropdownOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // save current form
  const handleSave = async () => {
    if (!selectedInterface) return;
    try {
      await window.dbAPI.saveNetworkSetup({
        interface: selectedInterface,
        ip_host: ipHost,
        subnet,
        pool_val1: poolVal1,
        pool_val2: poolVal2,
      });
      addLog(`Saved settings`, true);
    } catch (e) {
      console.error('Save failed:', e);
      addLog(`Save failed: ${e.message || e}`, false);
    }
  };

  // clear all setups
  const handleClear = async () => {
    try {
      await window.dbAPI.clearNetworkSetup();
      // reset form
      setIpHost('');
      setSubnet('');
      setPoolVal1('');
      setPoolVal2('');
      addLog('Cleared saved setup', true);
    } catch (e) {
      console.error('Clear failed:', e);
      addLog(`Clear failed: ${e.message || e}`, false);
    }
  };

  return (
    <div className='configsection-container'>
      <div className="title-config-section">DHCP Setup</div>

      <div className="main-config-section">
        {/* Interface selector */}
        <div className="input-section">
          <div className="input-label">Network Interface</div>
          <div className="interface-dropdown">
            <button
              className={`dropdown-btn ${isDropdownOpen ? 'rotated' : ''}`}
              onClick={toggleDropdown}
              disabled={!interfaces.length}
            >
              {selectedInterface || 'Select interface'}
              <VscChevronDown className={`chevron-icon ${isDropdownOpen ? 'rotated' : ''}`} />
            </button>
            {isDropdownOpen && (
              <ul className="dropdown-list">
                {interfaces.map(iface => (
                  <li key={iface} onClick={() => selectInterface(iface)}>{iface}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* IP Host / Gateway */}
        <div className="input-section">
          <div className="input-label">Host IP / Gateway IP</div>
          <input
            type="text"
            className='input-field'
            value={ipHost}
            onChange={e => setIpHost(e.target.value)}
            placeholder='192.168.2.1'
          />
        </div>

        {/* Subnet Mask */}
        <div className="input-section">
          <div className="input-label">Subnet Mask</div>
          <input
            type="text"
            className='input-field'
            value={subnet}
            onChange={e => setSubnet(e.target.value)}
            placeholder='255.255.255.0'
          />
        </div>

        {/* Pool Range */}
        <div className="input-section">
          <div className="input-label">Pool Range</div>
          <div className="two-inputs">
            <input
              type="text"
              className='input-field-pool-range'
              value={poolVal1}
              onChange={e => setPoolVal1(e.target.value)}
              placeholder='192.168.2.2'
            />
            <input
              type="text"
              className='input-field-pool-range'
              value={poolVal2}
              onChange={e => setPoolVal2(e.target.value)}
              placeholder='192.168.2.254'
            />
          </div>
        </div>
      </div>

      <div className="action-config-section">
        <div className="action-logs">
          {log && (
            <div className={`log ${log.valid ? 'valid' : 'invalid'}`}>{log.message}</div>
          )}
        </div>
        <VscSync    className='action-btn' onClick={handleClear} title="Clear All" />
        <VscSaveAll className='action-btn' onClick={handleSave} title="Save" />
      </div>
    </div>
  );
};

export default ServerConfigSection;