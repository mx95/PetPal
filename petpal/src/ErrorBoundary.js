import React from 'react';
import { isChunkLoadError } from './lazyWithRetry';

/**
 * Catches render errors (e.g. bad imports) so the tab isn’t a blank white screen.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error) {
      const chunkStale = isChunkLoadError(error);
      return (
        <div
          style={{
            minHeight: '100vh',
            padding: 24,
            maxWidth: 720,
            margin: '0 auto',
            fontFamily: 'system-ui, sans-serif',
            color: '#101828',
            background: 'linear-gradient(180deg, #f4fbff 0%, #fff 40%)',
          }}
        >
          <h1 style={{ marginTop: 0, fontSize: 28 }}>
            {chunkStale ? 'A new version is available' : 'Something went wrong'}
          </h1>
          <p style={{ color: '#475467', lineHeight: 1.5 }}>
            {chunkStale
              ? 'PetPal was updated while this tab was open. Reload to load the latest version.'
              : 'The app hit an error while rendering. Check the browser console, or do a hard refresh. If you changed Firebase or env config, set '}
            {!chunkStale ? (
              <>
                <code style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>.env.local</code> and restart the
                dev server (
                <code style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>yarn start</code>).
              </>
            ) : null}
          </p>
          {chunkStale ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                marginTop: 8,
                padding: '12px 20px',
                borderRadius: 999,
                border: 'none',
                background: '#5b37ff',
                color: '#fff',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Reload PetPal
            </button>
          ) : null}
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              fontSize: 12,
              marginTop: 16,
              padding: 12,
              background: 'rgba(220, 38, 38, 0.1)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              borderRadius: 8,
            }}
          >
            {error?.toString?.() || String(error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
