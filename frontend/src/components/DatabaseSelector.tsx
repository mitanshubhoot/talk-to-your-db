import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Stepper,
  Step,
  StepLabel,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material'
import {
  Storage,
  AccountTree,
  Cloud,
  Business,
  DataObject,
  StackedBarChart,
  TableChart,
  Analytics,
  Speed,
  CloudQueue,
  Apartment,
  Category,
  Delete,
  CheckCircle,
  Add,
  ArrowBack,
  Info,
} from '@mui/icons-material'

interface DatabaseType {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  color: string
}

const databaseTypes: DatabaseType[] = [
  {
    id: 'mysql',
    name: 'MySQL',
    icon: <Storage />,
    description: 'Popular open-source relational database',
    color: '#4479A1',
  },
  {
    id: 'mssql',
    name: 'Microsoft SQL Server',
    icon: <Business />,
    description: 'Enterprise database from Microsoft',
    color: '#CC2927',
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    icon: <AccountTree />,
    description: 'Advanced open-source database',
    color: '#336791',
  },
  {
    id: 'oracle',
    name: 'Oracle PL/SQL',
    icon: <Apartment />,
    description: 'Enterprise database solution',
    color: '#F80000',
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    icon: <DataObject />,
    description: 'Lightweight embedded database',
    color: '#003B57',
  },
  {
    id: 'snowflake',
    name: 'Snowflake',
    icon: <CloudQueue />,
    description: 'Cloud data platform',
    color: '#29B5E8',
  },
  {
    id: 'redshift',
    name: 'Redshift',
    icon: <StackedBarChart />,
    description: 'AWS data warehouse',
    color: '#FF9900',
  },
  {
    id: 'bigquery',
    name: 'BigQuery',
    icon: <Analytics />,
    description: 'Google Cloud analytics',
    color: '#4285F4',
  },
  {
    id: 'mariadb',
    name: 'MariaDB',
    icon: <Speed />,
    description: 'MySQL-compatible database',
    color: '#003545',
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    icon: <Category />,
    description: 'NoSQL document database',
    color: '#47A248',
  },
  {
    id: 'clickhouse',
    name: 'Clickhouse',
    icon: <TableChart />,
    description: 'Column-oriented database',
    color: '#FFCC02',
  },
  {
    id: 'other',
    name: 'Other Database',
    icon: <Cloud />,
    description: 'Connect to other databases',
    color: '#6B7280',
  },
]

const steps = ['Select Type', 'Configure', 'Connect']

interface DatabaseConnection {
  id: string
  name: string
  type: string
  database: string
  host?: string
  port?: number
  isDefault?: boolean
  metadata?: {
    isDemo?: boolean
    readOnly?: boolean
    demoVersion?: string
  }
}

interface DatabaseSelectorProps {
  onConnectionCreated?: (connectionId: string) => void
}

export const DatabaseSelector: React.FC<DatabaseSelectorProps> = ({
  onConnectionCreated,
}) => {
  const [view, setView] = useState<'list' | 'create'>('list')
  const [connections, setConnections] = useState<DatabaseConnection[]>([])
  const [loadingConnections, setLoadingConnections] = useState(true)
  const [activeStep, setActiveStep] = useState(0)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [connectionForm, setConnectionForm] = useState({
    name: '',
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    ssl: false,
    
    // Cloud-specific fields
    account: '',
    warehouse: '',
    role: '',
    schema: '',
    project: '',
    dataset: '',
    keyFile: '',
    cluster: '',
    region: '',
    filepath: '',
    
    // MongoDB specific
    authSource: '',
    authMechanism: ''
  })
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadConnections()
  }, [])

  const loadConnections = async () => {
    setLoadingConnections(true)
    try {
      const api = (await import('../services/api')).default
      const response = await api.get('/connections')
      if (response.data.success) {
        setConnections(response.data.data)
      }
    } catch (err) {
      console.error('Failed to load connections:', err)
    } finally {
      setLoadingConnections(false)
    }
  }

  const handleDeleteConnection = async (connectionId: string, isDemo: boolean) => {
    if (isDemo) {
      // Don't allow deletion of demo connection
      return
    }

    if (!window.confirm('Are you sure you want to delete this connection?')) {
      return
    }

    try {
      const api = (await import('../services/api')).default
      await api.delete(`/connections/${connectionId}`)
      await loadConnections()
    } catch (err) {
      console.error('Failed to delete connection:', err)
      setError('Failed to delete connection')
    }
  }

  const handleSwitchConnection = async (connectionId: string) => {
    try {
      const api = (await import('../services/api')).default
      // Set as default connection
      await api.post(`/connections/${connectionId}/set-default`)
      
      // Reload connections to reflect the change
      await loadConnections()
      
      // Notify parent and reload
      if (onConnectionCreated) {
        onConnectionCreated(connectionId)
      }
    } catch (err) {
      console.error('Failed to switch connection:', err)
      setError('Failed to switch connection')
    }
  }

  const handleTypeSelect = (typeId: string) => {
    setSelectedType(typeId)
    // Set default port based on database type
    const defaultPorts: { [key: string]: number } = {
      mysql: 3306,
      mariadb: 3306,
      postgresql: 5432,
      redshift: 5432,
      mssql: 1433,
      oracle: 1521,
      mongodb: 27017,
      clickhouse: 9000,
      snowflake: 443,
      bigquery: 443,
    }
    
    // Reset form with database-specific defaults
    setConnectionForm({
      name: `${databaseTypes.find(t => t.id === typeId)?.name} Connection`,
      host: 'localhost',
      port: defaultPorts[typeId] || 5432,
      database: '',
      username: '',
      password: '',
      ssl: false,
      
      // Cloud-specific fields
      account: '',
      warehouse: '',
      role: '',
      schema: '',
      project: '',
      dataset: '',
      keyFile: '',
      cluster: '',
      region: '',
      filepath: '',
      
      // MongoDB specific
      authSource: '',
      authMechanism: ''
    })
  }

  const handleNext = () => {
    if (activeStep === 0 && selectedType) {
      setActiveStep(1)
    } else if (activeStep === 1) {
      handleConnect()
    }
  }

  const handleBack = () => {
    setActiveStep(prev => prev - 1)
  }

  const isFormValid = () => {
    if (!connectionForm.name || !selectedType) return false
    
    switch (selectedType) {
      case 'sqlite':
        return !!connectionForm.filepath
      case 'snowflake':
        return !!(connectionForm.account && connectionForm.warehouse && connectionForm.database && connectionForm.username && connectionForm.password)
      case 'bigquery':
        return !!connectionForm.project
      case 'mongodb':
        return !!(connectionForm.host && connectionForm.database)
      default:
        // Standard SQL databases
        return !!(connectionForm.host && connectionForm.database && connectionForm.username)
    }
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    setError(null)
    
    try {
      // Create the connection data object
      const connectionData = {
        name: connectionForm.name,
        type: selectedType,
        host: connectionForm.host,
        port: connectionForm.port,
        database: connectionForm.database,
        username: connectionForm.username,
        password: connectionForm.password,
        ssl: connectionForm.ssl,
        isDefault: true, // Set as default connection
        
        // Cloud-specific fields
        account: connectionForm.account,
        warehouse: connectionForm.warehouse,
        role: connectionForm.role,
        schema: connectionForm.schema,
        project: connectionForm.project,
        dataset: connectionForm.dataset,
        keyFile: connectionForm.keyFile,
        cluster: connectionForm.cluster,
        region: connectionForm.region,
        filepath: connectionForm.filepath,
        
        // MongoDB specific
        authSource: connectionForm.authSource,
        authMechanism: connectionForm.authMechanism
      }

      // Use the API service for better error handling
      const api = (await import('../services/api')).default
      
      // Test the connection first
      console.log('Testing connection with data:', connectionData)
      const testResponse = await api.post('/connections/test', connectionData)
      
      if (!testResponse.data.success) {
        throw new Error(testResponse.data.error?.message || 'Connection test failed')
      }

      console.log('Connection test successful, creating connection...')
      
      // If test passes, create the connection
      const createResponse = await api.post('/connections', connectionData)
      
      if (!createResponse.data.success) {
        throw new Error(createResponse.data.error?.message || 'Failed to create connection')
      }
      
      console.log('Connection created successfully:', createResponse.data.data)
      
      // Reload connections list
      await loadConnections()
      
      // Show success step
      setActiveStep(2)
      if (onConnectionCreated) {
        onConnectionCreated(createResponse.data.data.id)
      }
    } catch (err: any) {
      console.error('Connection error:', err)
      let errorMessage = 'Failed to connect to database'
      
      if (err.response?.data?.error?.message) {
        errorMessage = err.response.data.error.message
      } else if (err.message) {
        errorMessage = err.message
      }
      
      // Provide more specific error messages based on common issues
      if (errorMessage.includes('ECONNREFUSED')) {
        errorMessage = 'Connection refused. Please check if the database server is running and accessible.'
      } else if (errorMessage.includes('authentication failed')) {
        errorMessage = 'Authentication failed. Please check your username and password.'
      } else if (errorMessage.includes('database') && errorMessage.includes('does not exist')) {
        errorMessage = 'Database does not exist. Please check the database name.'
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Connection timeout. Please check your network connection and database server.'
      }
      
      setError(errorMessage)
    } finally {
      setIsConnecting(false)
    }
  }

  const renderConnectionsList = () => (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Database Connections
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Manage your database connections
        </Typography>
      </Box>

      {loadingConnections ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {connections.length > 0 && (
            <Paper sx={{ mb: 4, border: '1px solid #374151' }}>
              <List>
                {connections.map((connection, index) => {
                  const isDemo = connection.metadata?.isDemo === true
                  const isReadOnly = connection.metadata?.readOnly === true
                  
                  return (
                    <React.Fragment key={connection.id}>
                      {index > 0 && <Divider />}
                      <ListItem
                        sx={{
                          py: 2,
                          px: 3,
                          '&:hover': {
                            bgcolor: 'rgba(59, 130, 246, 0.05)'
                          }
                        }}
                      >
                        <ListItemIcon>
                          <Storage sx={{ color: 'primary.main', fontSize: 32 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Typography variant="h6" sx={{ fontWeight: 500 }}>
                                {connection.name}
                              </Typography>
                              {isDemo && (
                                <Chip
                                  label="Demo Database"
                                  size="small"
                                  sx={{
                                    bgcolor: 'primary.main',
                                    color: 'white',
                                    fontWeight: 600,
                                    fontSize: '0.75rem'
                                  }}
                                />
                              )}
                              {isReadOnly && (
                                <Chip
                                  label="Read-Only"
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    borderColor: 'warning.main',
                                    color: 'warning.main',
                                    fontSize: '0.75rem'
                                  }}
                                />
                              )}
                              {connection.isDefault && (
                                <Chip
                                  label="Active"
                                  size="small"
                                  icon={<CheckCircle sx={{ fontSize: 14 }} />}
                                  sx={{
                                    bgcolor: 'success.main',
                                    color: 'white',
                                    fontWeight: 600,
                                    fontSize: '0.75rem'
                                  }}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                {connection.type.toUpperCase()} • {connection.database}
                              </Typography>
                              {connection.host && (
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                  {connection.host}:{connection.port}
                                </Typography>
                              )}
                              {isDemo && (
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', display: 'block', mt: 0.5 }}>
                                  This is a demo database with sample data. Connect your own database to work with real data.
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          {!connection.isDefault && (
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => handleSwitchConnection(connection.id)}
                              sx={{ borderColor: '#374151' }}
                            >
                              Switch To
                            </Button>
                          )}
                          {!isDemo && (
                            <Tooltip title="Delete Connection">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteConnection(connection.id, isDemo)}
                                sx={{ color: 'error.main' }}
                              >
                                <Delete />
                              </IconButton>
                            </Tooltip>
                          )}
                          {isDemo && (
                            <Tooltip title="Demo connections cannot be deleted">
                              <IconButton
                                size="small"
                                disabled
                                sx={{ color: 'text.disabled' }}
                              >
                                <Info />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </ListItem>
                    </React.Fragment>
                  )
                })}
              </List>
            </Paper>
          )}

          {connections.length === 0 && (
            <Paper sx={{ p: 6, textAlign: 'center', border: '1px solid #374151', mb: 4 }}>
              <Storage sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                No Connections Yet
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Add your first database connection to get started
              </Typography>
            </Paper>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<Add />}
              onClick={() => {
                setView('create')
                setActiveStep(0)
                setSelectedType(null)
                setError(null)
              }}
              sx={{ px: 4, py: 1.5 }}
            >
              Add New Connection
            </Button>
          </Box>
        </>
      )}
    </Box>
  )

  const renderTypeSelection = () => (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => setView('list')}
          sx={{ color: 'text.secondary' }}
        >
          Back to Connections
        </Button>
      </Box>
      
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Add your database
        </Typography>
        <Stepper activeStep={activeStep} sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <Typography variant="h5" sx={{ mb: 4 }}>
        Select your database type
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {databaseTypes.map((dbType) => (
          <Grid item xs={6} sm={4} md={2.4} key={dbType.id}>
            <Card
              sx={{
                cursor: 'pointer',
                              border: selectedType === dbType.id ? '2px solid #3B82F6' : '1px solid #374151',
              backgroundColor: selectedType === dbType.id ? 'rgba(59, 130, 246, 0.1)' : 'background.paper',
                transition: 'all 0.2s ease-in-out',
                                  '&:hover': {
                    borderColor: '#3B82F6',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 25px rgba(59, 130, 246, 0.2)',
                  },
                height: '120px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={() => handleTypeSelect(dbType.id)}
            >
              <CardContent sx={{ textAlign: 'center', p: 2 }}>
                <Box sx={{ color: dbType.color, mb: 1 }}>
                  {dbType.icon}
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {dbType.name}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          onClick={handleNext}
          disabled={!selectedType}
          sx={{ px: 4, py: 1.5 }}
        >
          Continue
        </Button>
      </Box>
    </Box>
  )

  const renderConnectionForm = () => {
    const selectedTypeData = databaseTypes.find(t => t.id === selectedType)
    
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto' }}>
        <Box sx={{ mb: 4 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => setView('list')}
            sx={{ color: 'text.secondary' }}
          >
            Back to Connections
          </Button>
        </Box>
        
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h4" sx={{ mb: 2 }}>
            Configure {selectedTypeData?.name}
          </Typography>
          <Stepper activeStep={activeStep} sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        <Paper sx={{ p: 4, border: '1px solid #374151' }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Connection Name"
                value={connectionForm.name}
                onChange={(e) => setConnectionForm(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </Grid>
            
            {/* SQLite specific fields */}
            {selectedType === 'sqlite' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Database File Path"
                  value={connectionForm.filepath}
                  onChange={(e) => setConnectionForm(prev => ({ ...prev, filepath: e.target.value }))}
                  placeholder="./database.db"
                  required
                />
              </Grid>
            )}

            {/* Snowflake specific fields */}
            {selectedType === 'snowflake' && (
              <>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Account"
                    value={connectionForm.account}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, account: e.target.value }))}
                    placeholder="your-account.snowflakecomputing.com"
                    required
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Warehouse"
                    value={connectionForm.warehouse}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, warehouse: e.target.value }))}
                    placeholder="COMPUTE_WH"
                    required
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Role (Optional)"
                    value={connectionForm.role}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, role: e.target.value }))}
                    placeholder="ACCOUNTADMIN"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Database Name"
                    value={connectionForm.database}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, database: e.target.value }))}
                    required
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Username"
                    value={connectionForm.username}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, username: e.target.value }))}
                    required
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Password"
                    type="password"
                    value={connectionForm.password}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </Grid>
              </>
            )}

            {/* BigQuery specific fields */}
            {selectedType === 'bigquery' && (
              <>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Project ID"
                    value={connectionForm.project}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, project: e.target.value }))}
                    placeholder="your-project-id"
                    required
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Dataset"
                    value={connectionForm.dataset}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, dataset: e.target.value }))}
                    placeholder="your_dataset"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Service Account Key File (Optional)"
                    value={connectionForm.keyFile}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, keyFile: e.target.value }))}
                    placeholder="path/to/service-account.json"
                  />
                </Grid>
              </>
            )}

            {/* MongoDB specific fields */}
            {selectedType === 'mongodb' && (
              <>
                <Grid item xs={8}>
                  <TextField
                    fullWidth
                    label="Host"
                    value={connectionForm.host}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, host: e.target.value }))}
                    required
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="Port"
                    type="number"
                    value={connectionForm.port}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Database Name"
                    value={connectionForm.database}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, database: e.target.value }))}
                    required
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Username"
                    value={connectionForm.username}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, username: e.target.value }))}
                    required
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Password"
                    type="password"
                    value={connectionForm.password}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, password: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Auth Source (Optional)"
                    value={connectionForm.authSource}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, authSource: e.target.value }))}
                    placeholder="admin"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Auth Mechanism (Optional)"
                    select
                    value={connectionForm.authMechanism}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, authMechanism: e.target.value }))}
                    SelectProps={{ native: true }}
                  >
                    <option value="">Default</option>
                    <option value="SCRAM-SHA-1">SCRAM-SHA-1</option>
                    <option value="SCRAM-SHA-256">SCRAM-SHA-256</option>
                    <option value="MONGODB-CR">MONGODB-CR</option>
                  </TextField>
                </Grid>
              </>
            )}

            {/* Standard SQL databases (PostgreSQL, MySQL, MariaDB, MSSQL, Oracle, Redshift, ClickHouse) */}
            {!['sqlite', 'snowflake', 'bigquery', 'mongodb'].includes(selectedType || '') && (
              <>
                <Grid item xs={8}>
                  <TextField
                    fullWidth
                    label="Host"
                    value={connectionForm.host}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, host: e.target.value }))}
                    required
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="Port"
                    type="number"
                    value={connectionForm.port}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Database Name"
                    value={connectionForm.database}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, database: e.target.value }))}
                    required
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Username"
                    value={connectionForm.username}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, username: e.target.value }))}
                    required
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Password"
                    type="password"
                    value={connectionForm.password}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </Grid>
              </>
            )}

            {/* Cloud database region field */}
            {['snowflake', 'bigquery', 'redshift'].includes(selectedType || '') && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Region (Optional)"
                  value={connectionForm.region}
                  onChange={(e) => setConnectionForm(prev => ({ ...prev, region: e.target.value }))}
                  placeholder="us-west-2"
                />
              </Grid>
            )}

            {/* SSL option for SQL databases */}
            {!['sqlite', 'bigquery'].includes(selectedType || '') && (
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={connectionForm.ssl}
                      onChange={(e) => setConnectionForm(prev => ({ ...prev, ssl: e.target.checked }))}
                    />
                  }
                  label="Use SSL Connection"
                />
              </Grid>
            )}
          </Grid>

          {error && (
            <Alert severity="error" sx={{ mt: 3 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button
              variant="outlined"
              onClick={handleBack}
              sx={{ borderColor: '#374151' }}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleConnect}
              disabled={isConnecting || !isFormValid()}
              sx={{ px: 4 }}
            >
              {isConnecting ? 'Connecting...' : 'Test & Connect'}
            </Button>
          </Box>
        </Paper>
      </Box>
    )
  }

  const renderSuccess = () => (
    <Box sx={{ maxWidth: 600, mx: 'auto', textAlign: 'center' }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Connection Successful!
      </Typography>
      <Stepper activeStep={activeStep} sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      
      <Paper sx={{ p: 4, border: '1px solid #374151' }}>
        <Box sx={{ color: 'success.main', mb: 2 }}>
          <CheckCircle sx={{ fontSize: 48 }} />
        </Box>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {connectionForm.name}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
          Your database connection has been established successfully. You can now start querying your data with AI.
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="outlined"
            onClick={() => {
              setView('list')
              setActiveStep(0)
            }}
            sx={{ px: 4, borderColor: '#374151' }}
          >
            View Connections
          </Button>
          <Button
            variant="contained"
            onClick={() => window.location.reload()}
            sx={{ px: 4 }}
          >
            Start Querying
          </Button>
        </Box>
      </Paper>
    </Box>
  )

  return (
    <Box sx={{ p: 4, minHeight: '100vh', bgcolor: 'background.default' }}>
      {view === 'list' && renderConnectionsList()}
      {view === 'create' && (
        <>
          {activeStep === 0 && renderTypeSelection()}
          {activeStep === 1 && renderConnectionForm()}
          {activeStep === 2 && renderSuccess()}
        </>
      )}
    </Box>
  )
} 