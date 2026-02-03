'use client';

import { useState, useCallback } from 'react';
import { useUpdate } from '@/context/UpdateContext';
import Modal, { ModalHeader, ModalBody, ModalFooter } from './Modal';

/**
 * Non-intrusive update notification that appears when an update is available.
 * Shows as a small banner that can be expanded to show full release notes.
 */
export default function UpdateNotification() {
  const {
    status,
    updateInfo,
    downloadProgress,
    error,
    downloadAndInstall,
    dismissUpdate,
  } = useUpdate();

  const [showDetails, setShowDetails] = useState(false);

  const handleUpdate = useCallback(() => {
    downloadAndInstall();
    setShowDetails(false);
  }, [downloadAndInstall]);

  const handleDismiss = useCallback(() => {
    dismissUpdate();
    setShowDetails(false);
  }, [dismissUpdate]);

  // Don't render anything if no update is available or if we're idle
  if (status === 'idle' || status === 'checking' || !updateInfo) {
    return null;
  }

  // Show error state
  if (status === 'error') {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '16px',
          zIndex: 150,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          background: 'var(--bg-secondary)',
          border: '1px solid #ef4444',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          maxWidth: '360px',
          animation: 'slideInRight 0.2s ease',
        }}
      >
        <span style={{ color: '#ef4444', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </span>
        <div style={{ flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Update Failed
          </p>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {error || 'An error occurred'}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          style={{
            padding: '4px',
            background: 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            transition: 'color 0.1s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-tertiary)';
          }}
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
        <style jsx>{`
          @keyframes slideInRight {
            from {
              opacity: 0;
              transform: translateX(100%);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}</style>
      </div>
    );
  }

  // Show downloading/ready state
  if (status === 'downloading' || status === 'ready') {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '16px',
          zIndex: 150,
          padding: '12px 16px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--accent-primary)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          minWidth: '280px',
          maxWidth: '360px',
          animation: 'slideInRight 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>
            {status === 'downloading' ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ animation: 'spin 1s linear infinite' }}
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
          </span>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {status === 'downloading' ? 'Downloading update...' : 'Update ready!'}
          </p>
        </div>

        {status === 'downloading' && (
          <div style={{ marginTop: '8px' }}>
            <div
              style={{
                height: '4px',
                background: 'var(--bg-tertiary)',
                borderRadius: '2px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${downloadProgress}%`,
                  background: 'var(--accent-primary)',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-sans)',
                textAlign: 'right',
              }}
            >
              {downloadProgress}%
            </p>
          </div>
        )}

        {status === 'ready' && (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Restarting application...
          </p>
        )}
        <style jsx>{`
          @keyframes slideInRight {
            from {
              opacity: 0;
              transform: translateX(100%);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  // Show update available notification
  return (
    <>
      {/* Compact notification banner */}
      <div
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '16px',
          zIndex: 150,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--accent-primary)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          maxWidth: '360px',
          animation: 'slideInRight 0.2s ease',
        }}
      >
        {/* Update icon */}
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            background: 'var(--accent-subtle)',
            borderRadius: '50%',
            flexShrink: 0,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </span>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Update Available
          </p>
          <p
            style={{
              margin: '2px 0 0',
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            v{updateInfo.currentVersion} → v{updateInfo.newVersion}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={() => setShowDetails(true)}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'background 0.1s ease, color 0.1s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            Details
          </button>
          <button
            onClick={handleUpdate}
            style={{
              padding: '6px 12px',
              background: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'opacity 0.1s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            Update
          </button>
          <button
            onClick={handleDismiss}
            style={{
              padding: '4px',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              transition: 'color 0.1s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
            aria-label="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        <style jsx>{`
          @keyframes slideInRight {
            from {
              opacity: 0;
              transform: translateX(100%);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}</style>
      </div>

      {/* Details Modal */}
      <Modal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        maxWidth="500px"
      >
        <ModalHeader>
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                background: 'var(--accent-subtle)',
                borderRadius: '50%',
                flexShrink: 0,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent-primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </span>
            Update Available
          </span>
        </ModalHeader>

        <ModalBody>
          {/* Version info */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
            }}
          >
            <div style={{ textAlign: 'center', flex: 1 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Current
              </p>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                v{updateInfo.currentVersion}
              </p>
            </div>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-tertiary)"
              strokeWidth="2"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                New
              </p>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                v{updateInfo.newVersion}
              </p>
            </div>
          </div>

          {/* Release date */}
          {updateInfo.releaseDate && (
            <p
              style={{
                margin: '0 0 12px',
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Released: {new Date(updateInfo.releaseDate).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          )}

          {/* Release notes */}
          <div>
            <p
              style={{
                margin: '0 0 8px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Release Notes
            </p>
            <div
              style={{
                padding: '12px',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  lineHeight: '1.6',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {updateInfo.releaseNotes}
              </p>
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <button
            onClick={() => setShowDetails(false)}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'background 0.1s ease, color 0.1s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            Later
          </button>
          <button
            onClick={handleUpdate}
            style={{
              padding: '8px 16px',
              background: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'opacity 0.1s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Update Now
          </button>
        </ModalFooter>
      </Modal>
    </>
  );
}
