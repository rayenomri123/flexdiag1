import React, {useState, useEffect} from 'react'
import './UdsConfigSection.css'
import { VscSaveAll, VscSync } from 'react-icons/vsc'

const UdsConfigSection = () => {

  const [logicalAdd, setLogicalAdd] = useState('');
  const [log, setLog] = useState(null);

  const addLog = (message, valid) => {
    setLog({ message, valid });
    setTimeout(() => setLog(null), 2000);
  };

  useEffect(() => {
    (async () => {
      try {
        const rows = await window.dbAPI.fetchUdsSetup();
        if (rows.length) {
          const saved = rows[0];
          setLogicalAdd(saved.logical_add);
        }
      } catch (e) {
        console.error('Initialization failed:', e);
        addLog('Initialization failed', false);
      }
    })();
  }, []);

  const handleSave = async () => {
    try {
      await window.dbAPI.saveUdsSetup({
        logical_add: logicalAdd,
      });
      addLog(`Saved uds setup`, true);
    } catch (e) {
      console.error('Save failed:', e);
      addLog(`Save failed: ${e.message || e}`, false);
    }
  };

  const handleClear = async () => {
    try {
      await window.dbAPI.clearUdsSetup();
      setLogicalAdd('');
      addLog('Cleared saved setup', true);
    } catch (e) {
      console.error('Clear failed:', e);
      addLog(`Clear failed: ${e.message || e}`, false);
    }
  };

  return (
    <div className='UdsConfigSection-container'>
        <div className="title-config-section">DHCP Configuration</div>
        <div className="main-config-section">
            <div className="input-section">
                <div className="input-label">Logical Address</div>
                <input 
                  type="text"
                  placeholder='0x545'
                  className='input-field'
                  value={logicalAdd}
                  onChange={e => setLogicalAdd(e.target.value)}
                />
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
  )
}

export default UdsConfigSection
