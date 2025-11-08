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
  Chip,
} from '@mui/material'

interface QueryResult {
  rows?: any[]
  rowCount?: number
  fields?: Array<{ name: string; dataTypeID?: number; oid?: number }>
  error?: string
  executionTime?: number
}

interface ResultsTableProps {
  result: QueryResult | null
  error?: string
}

// Helper function to format cell values based on PostgreSQL data types
const formatCellValue = (value: any, dataTypeID?: number): React.ReactNode => {
  if (value === null || value === undefined) {
    return <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>null</Typography>
  }

  // Handle different PostgreSQL data types
  if (dataTypeID) {
    switch (dataTypeID) {
      case 16: // boolean
        return (
          <Chip 
            label={value ? 'true' : 'false'} 
            size="small" 
            color={value ? 'success' : 'default'}
            variant="outlined"
          />
        )
      case 1082: // date
      case 1083: // time
      case 1114: // timestamp
      case 1184: // timestamptz
        return <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{String(value)}</Typography>
      case 114: // json
      case 3802: // jsonb
        try {
          const jsonString = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
          return (
            <Typography 
              variant="body2" 
              sx={{ 
                fontFamily: 'monospace', 
                maxWidth: 300, 
                overflow: 'hidden', 
                textOverflow: 'ellipsis',
                whiteSpace: 'pre-wrap'
              }}
              title={jsonString}
            >
              {jsonString.length > 100 ? `${jsonString.substring(0, 100)}...` : jsonString}
            </Typography>
          )
        } catch {
          return String(value)
        }
      case 25: // text
      case 1043: // varchar
      case 1042: // char
        const stringValue = String(value);
        return stringValue.length > 100 ? (
          <Typography variant="body2" title={stringValue}>
            {stringValue.substring(0, 100)}...
          </Typography>
        ) : stringValue
      case 23: // int4
      case 20: // int8
      case 21: // int2
        return (
          <Typography variant="body2" sx={{ fontFamily: 'monospace', textAlign: 'right' }}>
            {Number(value).toLocaleString()}
          </Typography>
        )
      case 700: // float4
      case 701: // float8
      case 1700: // numeric
        return (
          <Typography variant="body2" sx={{ fontFamily: 'monospace', textAlign: 'right' }}>
            {Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 })}
          </Typography>
        )
      default:
        return String(value)
    }
  }

  // Fallback formatting for unknown types
  if (typeof value === 'object') {
    try {
      const jsonString = JSON.stringify(value, null, 2);
      return (
        <Typography 
          variant="body2" 
          sx={{ 
            fontFamily: 'monospace', 
            maxWidth: 300, 
            overflow: 'hidden', 
            textOverflow: 'ellipsis',
            whiteSpace: 'pre-wrap'
          }}
          title={jsonString}
        >
          {jsonString.length > 100 ? `${jsonString.substring(0, 100)}...` : jsonString}
        </Typography>
      )
    } catch {
      return String(value)
    }
  }

  // Handle numbers
  if (typeof value === 'number') {
    return (
      <Typography variant="body2" sx={{ fontFamily: 'monospace', textAlign: 'right' }}>
        {value.toLocaleString()}
      </Typography>
    )
  }

  // Handle booleans
  if (typeof value === 'boolean') {
    return (
      <Chip 
        label={value ? 'true' : 'false'} 
        size="small" 
        color={value ? 'success' : 'default'}
        variant="outlined"
      />
    )
  }

  return String(value)
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ result, error }) => {
  // Handle error state
  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>Query Error:</Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>{error}</Typography>
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Common solutions:
          </Typography>
          <ul style={{ margin: '4px 0', paddingLeft: '20px', fontSize: '12px', color: '#666' }}>
            <li>Check your SQL syntax</li>
            <li>Verify table and column names exist</li>
            <li>Ensure you have proper database permissions</li>
          </ul>
        </Box>
      </Alert>
    )
  }

  // Handle no result
  if (!result) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="body2">No query executed yet</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
          Enter a natural language query or SQL statement to see results here
        </Typography>
      </Alert>
    )
  }

  // Handle result error
  if (result.error) {
    const isSecurityError = result.error.includes('not allowed') || result.error.includes('security');
    const isSyntaxError = result.error.includes('syntax error');
    const isTableError = result.error.includes('does not exist') || result.error.includes('not found');
    
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>Execution Error:</Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>{result.error}</Typography>
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {isSecurityError && 'Security restriction - only SELECT queries are allowed'}
            {isSyntaxError && 'SQL syntax issue - check your query structure'}
            {isTableError && 'Database object not found - verify names and permissions'}
            {!isSecurityError && !isSyntaxError && !isTableError && 'Suggestions:'}
          </Typography>
          {!isSecurityError && (
            <ul style={{ margin: '4px 0', paddingLeft: '20px', fontSize: '12px', color: '#666' }}>
              {isSyntaxError && (
                <>
                  <li>Check for missing commas, quotes, or parentheses</li>
                  <li>Verify SQL keywords are spelled correctly</li>
                </>
              )}
              {isTableError && (
                <>
                  <li>Check if the table/column names are correct</li>
                  <li>Verify you have access to the database objects</li>
                </>
              )}
              {!isSyntaxError && !isTableError && (
                <>
                  <li>Check your database connection</li>
                  <li>Verify your query syntax</li>
                  <li>Try a simpler query first</li>
                </>
              )}
            </ul>
          )}
        </Box>
      </Alert>
    )
  }

  // Handle empty results
  if (!result.rows || result.rows.length === 0) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="info">
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Query executed successfully</Typography>
          <Typography variant="body2">No rows returned from the database</Typography>
        </Alert>
        {result.executionTime !== undefined && (
          <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
            Execution time: {result.executionTime}ms
          </Typography>
        )}
      </Box>
    )
  }

  const columns = result.fields || []
  const maxRows = 1000 // Increased limit for better user experience
  const actualRowCount = result.rows.length
  const displayRowCount = Math.min(actualRowCount, maxRows)

  // Infer columns from first row if no field info available
  const displayColumns = columns.length === 0 && result.rows.length > 0 
    ? Object.keys(result.rows[0]).map(key => ({ name: key, dataTypeID: undefined }))
    : columns

  // Handle case where we have no columns to display
  if (displayColumns.length === 0) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="warning">
          <Typography variant="body2">Query executed but no column information available</Typography>
        </Alert>
        {result.executionTime !== undefined && (
          <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
            Execution time: {result.executionTime}ms
          </Typography>
        )}
      </Box>
    )
  }

  return (
    <Box sx={{ mt: 2 }}>
      {/* Execution info */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          <strong>{result.rowCount || actualRowCount}</strong> row{(result.rowCount || actualRowCount) !== 1 ? 's' : ''} returned
        </Typography>
        {result.executionTime !== undefined && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            • Execution time: <strong>{result.executionTime}ms</strong>
          </Typography>
        )}
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          • <strong>{displayColumns.length}</strong> column{displayColumns.length !== 1 ? 's' : ''}
        </Typography>
        {actualRowCount > maxRows && (
          <Chip 
            label={`Showing first ${maxRows} of ${actualRowCount} rows`} 
            size="small" 
            color="warning" 
            variant="outlined"
          />
        )}
      </Box>

      {/* Results table */}
      <TableContainer 
        component={Paper} 
        sx={{ 
          maxHeight: 500, 
          border: '1px solid #374151',
          '& .MuiTable-root': {
            minWidth: 650
          }
        }}
      >
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow sx={{ '& .MuiTableCell-head': { backgroundColor: '#1A1A1A', color: 'white' } }}>
              {displayColumns.map((field, index) => (
                <TableCell 
                  key={index} 
                  sx={{ 
                    fontWeight: 'bold', 
                    borderBottom: '1px solid #374151',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {field.name}
                  </Typography>
                  {field.dataTypeID && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      Type: {field.dataTypeID}
                    </Typography>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {result.rows.slice(0, displayRowCount).map((row, rowIndex) => (
              <TableRow 
                key={rowIndex} 
                sx={{ 
                  '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.04)' },
                  '&:nth-of-type(even)': { backgroundColor: 'rgba(255, 255, 255, 0.02)' }
                }}
              >
                {displayColumns.map((field, colIndex) => (
                  <TableCell 
                    key={colIndex} 
                    sx={{ 
                      borderBottom: '1px solid #374151', 
                      maxWidth: 300,
                      padding: '8px 16px',
                      verticalAlign: 'top'
                    }}
                  >
                    {formatCellValue(row[field.name], field.dataTypeID || (field as any).oid)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Footer info for large result sets */}
      {actualRowCount > maxRows && (
        <Box sx={{ mt: 2, p: 2, backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            <strong>Note:</strong> Only showing the first {maxRows} rows for performance. 
            Total rows: {actualRowCount}. Consider adding LIMIT clause to your query for better performance.
          </Typography>
        </Box>
      )}
    </Box>
  )
} 