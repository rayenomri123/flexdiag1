import React, { useState, useEffect } from 'react';
import './UdsDataDisplay.css'; // Import the CSS file

const UdsDataDisplay = () => {
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

  if (!udsData || !udsData.data) {
    return (
      <div className="uds-no-data">
        No UDS data available. Start the DHCP server to retrieve ECU information.
      </div>
    );
  }

  const { data } = udsData;
  const displayData = [
    { label: 'ECU Serial Number', value: data.ecuSerialNumber },
    { label: 'ECU Type Variant', value: data.ecuTypeVariant },
    { label: 'System Supplier', value: data.systemSupplierIdentifier },
    { label: 'ECU Hardware Number', value: data.vehicleManufacturerEcuHardwareNumber },
    { label: 'Spare Part Number', value: data.manufacturerSparePartNumber },
    { label: 'Index Service Data', value: data.indexSrvData },
  ];

  return (
    <div className="uds-container">
      <h2 className="uds-title">ECU Information</h2>
      <div className="uds-table-wrapper">
        <table className="uds-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {displayData.map((item, index) => (
              <tr key={index} className={index % 2 === 0 ? 'uds-row-alt' : ''}>
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
