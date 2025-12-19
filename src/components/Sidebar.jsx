import { useState, useEffect } from 'react'
import './Sidebar.css'

function Sidebar({ side = 'left', defaultWidth = 300, minWidth = 200, maxWidth = 600, children }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [width, setWidth] = useState(defaultWidth)
  const [isResizing, setIsResizing] = useState(false)

  const handleMouseDown = (e) => {
    setIsResizing(true)
    e.preventDefault()
  }

  const handleMouseMove = (e) => {
    if (!isResizing) return

    if (side === 'left') {
      const newWidth = e.clientX
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth)
      }
    } else {
      const newWidth = window.innerWidth - e.clientX
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth)
      }
    }
  }

  const handleMouseUp = () => {
    setIsResizing(false)
  }

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isResizing])

  return (
    <>
      <div
        className={`sidebar sidebar-${side} ${isCollapsed ? 'collapsed' : ''}`}
        style={{ width: isCollapsed ? '48px' : `${width}px` }}
      >
        <div className="sidebar-header">
          <button
            className="sidebar-toggle"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {side === 'left' ? (
              isCollapsed ? '→' : '←'
            ) : (
              isCollapsed ? '←' : '→'
            )}
          </button>
        </div>
        <div className="sidebar-content">
          {!isCollapsed && children}
        </div>
      </div>
      {!isCollapsed && (
        <div
          className={`sidebar-resizer sidebar-resizer-${side}`}
          onMouseDown={handleMouseDown}
        />
      )}
    </>
  )
}

export default Sidebar
