import React, { useEffect, useState, useRef } from 'react'
import './TitleBar.css'
import { VscClose, VscChromeMinimize, VscBell, VscCircleLargeFilled, VscColorMode, VscBroadcast, VscLayoutPanel, VscLayoutPanelOff, VscLayoutSidebarLeftOff, VscLayoutSidebarLeft, VscEllipsis, VscLayoutSidebarRight, VscLayoutSidebarRightOff } from 'react-icons/vsc'
import logo from '../../assets/logo.png'

const POLL_INTERVAL = 1000; // Check ethernet connectivity every 2s

const TitleBar = ({ dhcpOpen, setDhcpOpen, consoleOpen, setConsoleOpen, clickedButton, setClickedButton, secondWin, setSecondWin, configSection, setConfigSection}) => {
  
  const [isConnected, setIsConnected] = useState(false);
  const [appmenuOpen, setAppmenuOpen] = useState(false);
  const menuRef = useRef();

  useEffect(() => {
    let cancelled = false;

    const checkEthernet = async () => {
      const connected = await window.networkAPI.isEthernetConnected();
      if (!cancelled) {
        setIsConnected(connected);
      }
    };

    // initial check
    checkEthernet();

    // then poll every POLL_INTERVAL
    const handle = setInterval(checkEthernet, POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, []);

  const handleToggleDhcp = async () => {
    try {
      setDhcpOpen(!dhcpOpen);
      if (!dhcpOpen) {
        await window.dhcpAPI.start();
        console.log('DHCP started');
      } else {
        await window.dhcpAPI.stop();
        console.log('DHCP stopped');
      }
    } catch (err) {
      console.error('Error toggling DHCP:', err);
      alert('Failed to toggle DHCP. Check console for details.');
    }
  }

  const onDhcpClick = async () => {
    // const connected = await window.networkAPI.isEthernetConnected();
    // if (connected) {
    // if (true) { // for testing
    await handleToggleDhcp();
    // }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setAppmenuOpen(false);
      }
    };

    if (appmenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [appmenuOpen]);

  return (
    <div className='titlebar-container'>
        <div className={`connectivity-indicator ${isConnected ? 'connected' : ''}`}>
          <VscCircleLargeFilled className='connectivity-indicator-icon'/>
        </div>
        <div className="brand-section">
          <img src={logo} alt="Ampere logo" className='app-logo'/>
          <div className="app-name">FlexDiag</div>
        </div>
        <div className="layoutcontrols-section">
          <button className="optioncontrols-btn" onClick={() => {
            if (clickedButton !== '') {
              setClickedButton('')
            } else {
              setClickedButton('dhcp');
            }
          }}>
            {clickedButton === '' ? (
              <VscLayoutSidebarLeftOff className='optioncontrols-icon'/>
            ):(
              <VscLayoutSidebarLeft className='optioncontrols-icon'/>
            )}
          </button>
          <button className="optioncontrols-btn" onClick={() => setConsoleOpen(!consoleOpen)}>
            {consoleOpen ? (
              <VscLayoutPanel className='optioncontrols-icon'/>
            ):(
              <VscLayoutPanelOff className='optioncontrols-icon'/>
            )}
          </button>
          <button className="optioncontrols-btn" onClick={() => {
            if (configSection !== '') {
              setConfigSection('');
            } else {
              setConfigSection('dhcp');
            }
          }}>
            {configSection === '' ? (
              <VscLayoutSidebarRightOff className='optioncontrols-icon'/>
            ):(
              <VscLayoutSidebarRight className='optioncontrols-icon'/>
            )}
          </button>
        </div>

        {/* ________appmenu-section________ */}

        <div className="appmenu-section">
          <button className="optioncontrols-btn">
            <VscEllipsis className={`optioncontrols-icon ${appmenuOpen ? 'open' : ''}`} onClick={() => setAppmenuOpen(true)} />
          </button>
        </div>
        {appmenuOpen && (
          <ul ref={menuRef} className='appmenu-list' onClick={() => setAppmenuOpen(!appmenuOpen)}>
            <li onClick={() => setSecondWin(true)}>Settings</li>
            <li>Logout</li>
            <li>Help</li>
          </ul>
        )}

        {/* _______________________________ */}

        <div className="optioncontrols-section">
          <button className={`optioncontrols-btn ${dhcpOpen ? 'on' : 'off'}`} onClick={() => onDhcpClick()}>
              <VscBroadcast className='optioncontrols-icon1'/>
          </button>
          <button className="optioncontrols-btn">
            <VscColorMode className='optioncontrols-icon'/>
          </button>
          <button className="optioncontrols-btn">
            <VscBell className='optioncontrols-icon'/>
          </button>
        </div>
        <div className="wincontrols-section" >
            <button className="wincontrols-btn" onClick={() => window.windowControlsAPI.minimize()}>
                <VscChromeMinimize />
            </button>
            <button className="wincontrols-btn close" onClick={() => window.windowControlsAPI.close()}>
                <VscClose />
            </button>
        </div>
    </div>
  )
}

export default TitleBar
