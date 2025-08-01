import React from 'react'
import './MenubarUDS.css'
import { VscChevronRight } from 'react-icons/vsc'

const MenubarUDS = ({ configSection, setConfigSection }) => {
  return (
    <div className='Menubar-container'>
        <button className={`MenubarDHCP-btn ${configSection === 'uds' ? 'open' : ''}`} onClick={() => {
        
            if(configSection ==='uds') {
                setConfigSection('empty');
            } else {
                setConfigSection('uds');
            }

        }}>
        <VscChevronRight className='chvr'/><span>UDS setup</span>
        </button>
        <button className='MenubarDHCP-btn'><VscChevronRight className='chvr'/><span>Logs</span></button>
    </div>
  )
}

export default MenubarUDS