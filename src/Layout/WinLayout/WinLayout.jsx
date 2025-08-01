import React, { useState, useRef } from 'react'
import './WinLayout.css'
import TitleBar from '../TitleBar/TitleBar'
import SideBar from '../SideBar/SideBar'
import MenubarDHCP from '../../components/MenubarDHCP/MenubarDHCP'
import NetConfigSection from '../../components/NetConfigSection/NetConfigSection'
import ConfigSection from '../../components/ConfigSection/ConfigSection'
import DHCPLogs from '../../components/DHCPLogs/DHCPLogs'
import Console from '../../components/Console/Console'
import SettingsSection from '../../components/SettingsSection/SettingsSection'
import MenubarUDS from '../../components/MenubarUDS/MenubarUDS'
import UdsConfigSection from '../../components/UdsConfigSection/UdsConfigSection'
import UdsDataDisplay from '../../components/UdsDataDisplay/UdsDataDisplay'

const WinLayout = () => {
  const [clickedButton, setClickedButton] = useState('dhcp');
  const [configSection, setConfigSection] = useState('empty');
  const [isDhcpLogOpen, setIsDhcpLogOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [consoleFull, setConsoleFull] = useState(false);
  const [dhcpOpen, setDhcpOpen] = useState(false);
  const [secondWin, setSecondWin] = useState(false);
  const [logLines, setLogLines] = useState([]);
  const [displayContainer, setDisplayContainer] = useState('udsDataDisplay');
  const outputRef = useRef(null);

  return (
    <div className='win-container'>
      <div className="titlebar-section">
        <TitleBar 
          dhcpOpen={dhcpOpen} 
          setDhcpOpen={setDhcpOpen}
          consoleOpen={consoleOpen}
          setConsoleOpen={setConsoleOpen}
          clickedButton={clickedButton}
          setClickedButton={setClickedButton}
          secondWin={secondWin}
          setSecondWin={setSecondWin}
          configSection={configSection}
          setConfigSection={setConfigSection}
        />
      </div>
      <div className="main-win">
        <div className="sidebar-section">
          <SideBar 
            clickedButton={clickedButton}
            setClickedButton={setClickedButton}
          />
        </div>
        {clickedButton !== '' && (
          <div className="menubar-section">
            {clickedButton === 'dhcp' && (
              <MenubarDHCP 
                configSection={configSection}
                setConfigSection={setConfigSection}
                isDhcpLogOpen={isDhcpLogOpen}
                setIsDhcpLogOpen={setIsDhcpLogOpen}
              />
            )}
            {clickedButton === 'uds' && (
              <MenubarUDS 
                configSection={configSection}
                setConfigSection={setConfigSection}
              />
            )}
          </div>
        )}
        <div className="display-section">
          {!consoleFull && (
            <div className="display-container">
              {displayContainer === 'udsDataDisplay' && (
                <>
                  <div className="display-container-top">
                    <div className={`display-container-top-left ${!consoleOpen ? 'open' : ''}`}>
                      <UdsDataDisplay consoleOpen={consoleOpen}/>
                    </div>
                    <div className="display-container-top-right">
                      
                    </div>
                  </div>
                  <div className="display-container-middle">

                  </div>
                  <div className="display-container-bottom">

                  </div>
                </> 
              )}

            </div>
          )}
          {consoleOpen && (
            <div className={`console-section ${consoleFull ? 'full' : ''}`}>
              <Console
                consoleOpen={consoleOpen}
                setConsoleOpen={setConsoleOpen}
                consoleFull={consoleFull}
                setConsoleFull={setConsoleFull}
                dhcpOpen={dhcpOpen}
                setDhcpOpen={setDhcpOpen}
                logLines={logLines}
                setLogLines={setLogLines}
                outputRef={outputRef}
              />
            </div>
          )}
        </div>
        {configSection !=='' && (
          <div className="config-section">

            {configSection === 'empty' && (
              <ConfigSection />
            )}

            {configSection === 'dhcp' && (
              <NetConfigSection /> 
            )}

            {configSection === 'uds' && (
              <UdsConfigSection /> 
            )}

          </div>
        )}
      </div>
      {secondWin && (
        <div className="second-win-container">
          <SettingsSection 
            secondWin={secondWin}
            setSecondWin={setSecondWin}
          />
        </div>
      )} 
    </div>
  )
}

export default WinLayout