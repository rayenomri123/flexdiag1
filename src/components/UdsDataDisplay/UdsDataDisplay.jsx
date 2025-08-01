import React, { useState, useEffect } from 'react';
import './UdsDataDisplay.css';

const UdsDataDisplay = ({ consoleOpen }) => {
  const [udsData, setUdsData] = useState(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const data = await window.udsAPI.fetchUdsData();
        if (data) {
          setUdsData(data);
        }
      } catch (err) {
        console.error('Error fetching UDS data:', err);
      }
    };

    fetchInitialData();

    const removeListener = window.udsAPI.onUdsDataUpdate((data) => {
      setUdsData(data);
    });

    return () => removeListener();
  }, []);

  // Always render the table; if no data, dataObj will be {} and value || 'N/A' kicks in
  const dataObj = udsData?.data || {};

  const displayData = [
    { label: 'ECU Serial Number', value: dataObj.ecuSerialNumber },
    { label: 'ECU Type Variant', value: dataObj.ecuTypeVariant },
    { label: 'System Supplier', value: dataObj.systemSupplierIdentifier },
    { label: 'ECU Hardware Number', value: dataObj.vehicleManufacturerEcuHardwareNumber },
    { label: 'Spare Part Number', value: dataObj.manufacturerSparePartNumber },
    { label: 'Index Service Data', value: dataObj.indexSrvData },
  ];

  return (
    <div className={`uds-container ${!consoleOpen ? 'open' : ''}`}>
      <div className={`uds-title ${!consoleOpen ? 'open' : ''}`}>System Information</div>
      <div className="uds-table-wrapper">
        <table className={`uds-table ${udsData ? 'connected' : ''} ${!consoleOpen ? 'open' : ''}`}>
          <thead>
            <tr>
              <th>Field</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {displayData.map((item, index) => (
              <tr key={index} className={index % 2 === 1 ? 'uds-row-alt' : ''}>
                <td>{item.label}</td>
                <td>{item.value || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UdsDataDisplay;