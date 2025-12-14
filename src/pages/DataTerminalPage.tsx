import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import './DataTerminalPage.css';

import { fetchTerminalCustomers } from '../api/dataTerminal';
import { useAuthStore } from '../store/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function DataTerminalPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const { token, user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [customers, setCustomers] = useState<string[]>(['default']);
  const [selectedCustomer, setSelectedCustomer] = useState('default');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wsUrl = useMemo(() => {
    const base = API_BASE_URL.replace(/^http/, 'ws');
    const url = new URL('/api/console/reachnett/ws', base);
    if (token) {
      url.searchParams.set('token', token);
    }
    if (selectedCustomer) {
      url.searchParams.set('customer', selectedCustomer);
    }
    return url.toString();
  }, [token, selectedCustomer]);

  const teardownSocket = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
  }, []);

  const disconnectTerminal = useCallback(() => {
    teardownSocket();
    termRef.current?.dispose();
    termRef.current = null;
    fitAddonRef.current = null;
  }, [teardownSocket]);

  const initializeTerminal = useCallback(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 14,
      cursorBlink: true,
      convertEol: true,
      theme: {
        background: '#0f0f0f',
        foreground: '#e5e5e5',
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();

    termRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const handleResize = () => {
      requestAnimationFrame(() => fitAddon.fit());
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const connectSocket = useCallback(() => {
    // if (!token || !termRef.current) return;
    if (!termRef.current) return;

    setStatus('connecting');
    setErrorMessage(null);

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    const term = termRef.current;
    if (!term) {
      return;
    }

    const disposeDataListener = term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });

    socket.addEventListener('open', () => {
      setStatus('connected');
      termRef.current?.focus();
    });

    socket.addEventListener('error', () => {
      setStatus('error');
      setErrorMessage('WebSocket connection error');
    });

    socket.addEventListener('close', () => {
      setStatus((prev) => (prev === 'error' ? prev : 'idle'));
      termRef.current?.write('\r\n[connection closed]\r\n');
      disposeDataListener.dispose();
    });

    socket.addEventListener('message', (event) => {
      termRef.current?.write(event.data ?? '');
    });
  }, [token, wsUrl]);

  useEffect(() => {
    if (!token) return () => undefined;

    const cleanupResize = initializeTerminal();
    connectSocket();

    return () => {
      cleanupResize?.();
      disconnectTerminal();
    };
  }, [token, initializeTerminal, connectSocket, disconnectTerminal, wsUrl]);

  useEffect(() => {
    let active = true;

    if (!isAdmin) {
      setCustomers(['default']);
      setSelectedCustomer('default');
      return () => {
        active = false;
      };
    }

    fetchTerminalCustomers()
      .then((response) => {
        if (!active) return;
        const fetched = response.customers.length > 0 ? response.customers : ['default'];
        setCustomers(fetched);
        setSelectedCustomer((current) => (fetched.includes(current) ? current : fetched[0]));
      })
      .catch(() => {
        if (active) {
          setCustomers(['default']);
          setSelectedCustomer('default');
        }
      });
    return () => {
      active = false;
    };
  }, [isAdmin]);

  const handleCustomerChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedCustomer(value);
  };

  return (
    <div className="data-terminal-page">
      <div className="terminal-header">
        <div>
          <h2>Reachnett Data Terminal</h2>
          <p className="terminal-subtitle">
            Explore files under <code>/data/reachnett</code> via the backend data-terminal service.
          </p>
        </div>
        <div className={`status-pill status-${status}`}>
          {status === 'connected' && 'Connected'}
          {status === 'connecting' && 'Connecting...'}
          {status === 'idle' && 'Disconnected'}
          {status === 'error' && 'Error'}
        </div>
      </div>

      <div className="terminal-controls">
        <label className="control-group">
          <span>Customer Folder</span>
          <select
            value={selectedCustomer}
            onChange={handleCustomerChange}
            disabled={!isAdmin || status === 'connecting'}
          >
            {customers.map((customer) => (
              <option key={customer} value={customer}>
                {customer}
              </option>
            ))}
          </select>
        </label>
        <button
          className="terminal-button"
          type="button"
          onClick={() => {
            disconnectTerminal();
            initializeTerminal();
            connectSocket();
          }}
        >
          Reconnect
        </button>
      </div>

      {errorMessage && <div className="terminal-error">{errorMessage}</div>}

      <div className="terminal-shell" ref={containerRef} />
    </div>
  );
}
