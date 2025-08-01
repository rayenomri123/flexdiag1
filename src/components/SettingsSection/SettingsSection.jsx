import React, { useEffect, useRef, useState } from 'react';
import './SettingsSection.css';
import { VscChromeClose, VscSaveAll, VscSync } from 'react-icons/vsc';
import SettingsNetMode from '../SettingsNetMode/SettingsNetMode';

const SettingsSection = ({ secondWin, setSecondWin }) => {
  const settingsRef = useRef();
  const [netMode, setNetMode] = useState('');
  const [currentNetMode, setCurrentNetMode] = useState('');

  useEffect(() => {
    window.networkModeAPI
      .fetchMode()
      .then((mode) => setCurrentNetMode(mode))
      .catch((err) => console.error('Failed to fetch net mode:', err));
  }, []);

  // 2) Click‑outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setSecondWin(false);
      }
    };
    if (secondWin) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [secondWin]);

  // 3) Save handler
  const handleSave = async () => {
    if (!netMode) {
      console.warn('No network mode selected, nothing to save.');
      return;
    }

    try {
      await window.networkModeAPI.saveMode(netMode);
      console.log(`Network mode "${netMode}" saved successfully.`);
      // you could also show a toast or some UI feedback here
    } catch (err) {
      console.error('Error saving network mode:', err);
    }
  };

  return (
    <>
      <div ref={settingsRef} className='settings-section-container'>
        <div className="settings-navigation-section">
          {/* … */}
        </div>

        <div className="settings-display-section">
          <div className="settings-controls-section">
            <VscSync
              className='console-container-controls-icon'
              onClick={() => {
                // maybe re-fetch everything?
                window.networkModeAPI.fetchMode().then(setNetMode);
              }}
            />
            <VscSaveAll
              className='console-container-controls-icon'
              onClick={handleSave}
            />
          </div>

          <div className="settings-child-section">
            <SettingsNetMode
              netMode={netMode}
              setNetMode={setNetMode}
              currentNetMode={currentNetMode}
              setCurrentNetMode={setCurrentNetMode}
            />
          </div>
        </div>
      </div>

      <VscChromeClose
        className='settings-section-close-btn'
        onClick={() => setSecondWin(false)}
      />
    </>
  );
};

export default SettingsSection;