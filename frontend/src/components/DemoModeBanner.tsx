import React, { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Chip,
} from '@mui/material'
import {
  Close,
  Storage,
  PlayArrow,
} from '@mui/icons-material'

interface DemoModeBannerProps {
  onConnectDatabase: () => void
  onViewExamples: () => void
}

export const DemoModeBanner: React.FC<DemoModeBannerProps> = ({
  onConnectDatabase,
  onViewExamples,
}) => {
  const [isDismissed, setIsDismissed] = useState(false)

  // Load dismiss preference from localStorage on mount
  useEffect(() => {
    const dismissed = localStorage.getItem('demoModeBannerDismissed')
    if (dismissed === 'true') {
      setIsDismissed(true)
    }
  }, [])

  // Handle dismiss action
  const handleDismiss = () => {
    setIsDismissed(true)
    localStorage.setItem('demoModeBannerDismissed', 'true')
  }

  // Don't render if dismissed
  if (isDismissed) {
    return null
  }

  return (
    <Paper
      sx={{
        p: 3,
        mb: 4,
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
        border: '1px solid #60a5fa',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background pattern */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          opacity: 0.1,
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      {/* Content */}
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '12px',
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(10px)',
              }}
            >
              <Storage sx={{ color: 'white', fontSize: 28 }} />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
                  You're in Demo Mode
                </Typography>
                <Chip
                  label="DEMO"
                  size="small"
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.3)',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                  }}
                />
              </Box>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                You're exploring with sample e-commerce data. Connect your own database to query your real data.
              </Typography>
            </Box>
          </Box>
          <IconButton
            size="small"
            onClick={handleDismiss}
            sx={{
              color: 'white',
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.2)',
              },
            }}
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            onClick={onConnectDatabase}
            sx={{
              bgcolor: 'white',
              color: '#1e3a8a',
              fontWeight: 600,
              px: 3,
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.9)',
              },
            }}
          >
            Connect Your Database
          </Button>
          <Button
            variant="outlined"
            startIcon={<PlayArrow />}
            onClick={onViewExamples}
            sx={{
              borderColor: 'white',
              color: 'white',
              fontWeight: 600,
              '&:hover': {
                borderColor: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            View Example Queries
          </Button>
        </Box>
      </Box>
    </Paper>
  )
}
