import React from 'react'
import './SideBar.css'
import { VscGitMerge, VscBroadcast } from 'react-icons/vsc'

const SideBar = ({  
                    clickedButton,
                    setClickedButton
}) => {

  

  return (
    <div className='sidebar-container'>
      <button className={`sidebar-btn ${clickedButton === 'dhcp'  ? 'clicked' : ''}`} onClick={() => {
        if (clickedButton === 'dhcp') {
          setClickedButton('');
        } else {
          setClickedButton('dhcp');
        }
      }}>
        <VscBroadcast />
      </button>
      <button className={`sidebar-btn ${clickedButton ==='uds' ? 'clicked' : ''}`} onClick={() => {
        if (clickedButton === 'uds') {
          setClickedButton('');
        } else {
          setClickedButton('uds');
        }
      }}>
        <VscGitMerge />
      </button>
    </div>
  )
}

export default SideBar