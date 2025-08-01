import React, { useState, useEffect } from 'react';
import './Console.css';
import { VscChromeClose, VscChromeMaximize, VscDebugConsole, VscSync } from 'react-icons/vsc';

const Console = ({
  consoleOpen,
  setConsoleOpen,
  consoleFull,
  setConsoleFull,
  dhcpOpen,
  setDhcpOpen,
  logLines,
  setLogLines,
  outputRef
}) => {

  // Function to parse a log line into timestamp, type, and message
  const parseLogLine = (line) => {
    // Regex to match timestamp, message type, and the rest of the message
    const regex = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\s(\[.*?\])\s(.*)$/;
    const match = line.match(regex);

    if (match) {
      const [, timestamp, type, message] = match;
      // Extract the type without brackets for dynamic class
      const typeText = type.slice(1, -1); // Remove [ and ]
      // Check if the message contains JSON
      let formattedMessage = message;
      if (message.includes('{')) {
        try {
          const jsonStart = message.indexOf('{');
          const jsonStr = message.slice(jsonStart);
          const jsonObj = JSON.parse(jsonStr);
          formattedMessage = (
            <>
              {message.slice(0, jsonStart)}
              <pre className="log-json">{JSON.stringify(jsonObj, null, 2)}</pre>
            </>
          );
        } catch (e) {
          formattedMessage = message;
        }
      }
      return { timestamp, type: typeText, message: formattedMessage };
    }
    return { timestamp: '', type: '', message: line };
  };

  useEffect(() => {
    const handleLogUpdate = (event, line) => {
      setLogLines((prev) => {
        if (prev[prev.length - 1] === line) return prev;
        const newLines = [...prev, line];
        return newLines.length > 1000 ? newLines.slice(-1000) : newLines;
      });
    };

    window.ipcRenderer.on('log-update', handleLogUpdate);
    return () => {
      window.ipcRenderer.removeListener('log-update', handleLogUpdate);
    };
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [logLines]);

  return (
    <div className="console-container">
      <div className="console-container-controls">
        <div className="console-container-controls-title">Output</div>
        <VscSync 
          className="console-container-controls-icon"
          onClick={() => setLogLines([])}
        />
        <VscChromeMaximize
          className={`console-container-controls-icon ${consoleFull ? 'act' : ''}`}
          onClick={() => setConsoleFull(!consoleFull)}
        />
        <VscChromeClose
          className="console-container-controls-icon"
          onClick={() => {
            setConsoleOpen(false);
            setConsoleFull(false);
          }}
        /> 
      </div>
      {dhcpOpen ? (
        <div className="console-container-output" ref={outputRef}>
          {logLines.map((line, index) => {
            const { timestamp, type, message } = parseLogLine(line);
            return (
              <div className="log-line" key={index}>
                {timestamp && <span className="log-timestamp">{timestamp}</span>}
                {type && <span className={`log-type log-type-${type.toLowerCase()}`}>[{type}]</span>}
                {message && <span className="log-message">{message}</span>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="console-container-init">
          <VscDebugConsole className="console-container-init-icon" />
          <div className="console-container-init-title">Debug Console</div>
        </div>
      )}
    </div>
  );
};

export default Console;