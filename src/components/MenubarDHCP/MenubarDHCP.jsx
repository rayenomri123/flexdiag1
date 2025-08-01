import React from 'react'
import './MenubarDHCP.css'
import { VscChevronRight } from 'react-icons/vsc'

const MenubarDHCP = ({  configSection,
                        setConfigSection,
                        isDhcpLogOpen,
                        setIsDhcpLogOpen
}) => {
  return (
    <div className='Menubar-container'>
        <button className={`MenubarDHCP-btn ${configSection === 'dhcp' ? 'open' : ''}`} onClick={() => {
          
          if(configSection ==='dhcp') {
            setConfigSection('empty');
          } else {
            setConfigSection('dhcp');
          }

        }}>
          <VscChevronRight className='chvr'/><span>DHCP setup</span>
        </button>
        <button className='MenubarDHCP-btn'><VscChevronRight className='chvr'/><span>Server management</span></button>
        <button className={`MenubarDHCP-btn ${isDhcpLogOpen ? 'open' : ''}`} onClick={() => setIsDhcpLogOpen(!isDhcpLogOpen)}><VscChevronRight className='chvr'/><span>Logs</span></button>
    </div>
  )
}

export default MenubarDHCP