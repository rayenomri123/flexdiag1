import React from 'react'
import './ConfigSection.css'
import { VscTools } from 'react-icons/vsc'

const ConfigSection = () => {
  return (
    <div className='init-configsection-container'>
      <div className="tools-indicator-container">
        <VscTools className='tools-indicator-icon'/>
        <div className="tools-indicator-title">Config Tools</div>
      </div>
    </div>
  )
}

export default ConfigSection
