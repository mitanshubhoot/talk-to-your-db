import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Alert,
  Box,
} from '@mui/material'

interface QueryResult {
  rows?: any[]
  rowCount?: number
  fields?: Array<{ name: string; dataTypeID: number }>
}

interface ResultsTableProps {
  result: QueryResult
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ result }) => {
  if (!result.rows || result.rows.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No results found
      </Alert>
    )
  }

  const columns = result.fields || []
  const maxRows = 100 // Limit display for performance

  if (columns.length === 0 && result.rows.length > 0) {
    // If no field info, infer from first row
    const firstRow = result.rows[0]
    const inferredColumns = Object.keys(firstRow).map(key => ({ name: key, dataTypeID: 0 }))
    
    return (
      <TableContainer component={Paper} sx={{ mt: 2, maxHeight: 400, border: '1px solid #374151' }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow sx={{ '& .MuiTableCell-head': { backgroundColor: '#1A1A1A', color: 'white' } }}>
              {inferredColumns.map((field, index) => (
                <TableCell key={index} sx={{ fontWeight: 'bold', borderBottom: '1px solid #374151' }}>
                  {field.name}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {result.rows.slice(0, maxRows).map((row, rowIndex) => (
              <TableRow key={rowIndex} sx={{ '&:hover': { backgroundColor: '#374151' } }}>
                {inferredColumns.map((field, colIndex) => (
                  <TableCell key={colIndex} sx={{ borderBottom: '1px solid #374151' }}>
                    {row[field.name] !== null && row[field.name] !== undefined 
                      ? String(row[field.name]) 
                      : <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>null</Typography>
                    }
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {result.rows.length > maxRows && (
          <Box sx={{ p: 2, backgroundColor: '#1A1A1A', borderTop: '1px solid #374151' }}>
            <Alert severity="info">
              Showing first {maxRows} of {result.rowCount || result.rows.length} results
            </Alert>
          </Box>
        )}
      </TableContainer>
    )
  }

  return (
    <TableContainer component={Paper} sx={{ mt: 2, maxHeight: 400, border: '1px solid #374151' }}>
      <Table stickyHeader>
        <TableHead>
          <TableRow sx={{ '& .MuiTableCell-head': { backgroundColor: '#1A1A1A', color: 'white' } }}>
            {columns.map((field, index) => (
              <TableCell key={index} sx={{ fontWeight: 'bold', borderBottom: '1px solid #374151' }}>
                {field.name}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {result.rows.slice(0, maxRows).map((row, rowIndex) => (
            <TableRow key={rowIndex} sx={{ '&:hover': { backgroundColor: '#374151' } }}>
              {columns.map((field, colIndex) => (
                <TableCell key={colIndex} sx={{ borderBottom: '1px solid #374151' }}>
                  {row[field.name] !== null && row[field.name] !== undefined 
                    ? String(row[field.name]) 
                    : <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>null</Typography>
                  }
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {result.rows.length > maxRows && (
        <Box sx={{ p: 2, backgroundColor: '#1A1A1A', borderTop: '1px solid #374151' }}>
          <Alert severity="info">
            Showing first {maxRows} of {result.rowCount || result.rows.length} results
          </Alert>
        </Box>
      )}
    </TableContainer>
  )
} 