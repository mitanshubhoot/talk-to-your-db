import React, { useState } from 'react'
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

interface DatabaseSelectorProps {
  onConnectionCreated?: (connectionId: string) => void
}

export const DatabaseSelector: React.FC<DatabaseSelectorProps> = ({
  onConnectionCreated,
}) => {
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
        isDefault: false,
        
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

      // Test the connection first
      const testResponse = await fetch('/api/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectionData)
      })
      
      const testData = await testResponse.json()
      if (!testData.success) {
        throw new Error(testData.error?.message || 'Connection test failed')
      }

      // If test passes, create the connection
      const createResponse = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectionData)
      })
      
      const createData = await createResponse.json()
      if (!createData.success) {
        throw new Error(createData.error?.message || 'Failed to create connection')
      }
      
      // Show success step
      setActiveStep(2)
      if (onConnectionCreated) {
        onConnectionCreated(createData.data.id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to database')
    } finally {
      setIsConnecting(false)
    }
  }

  const renderTypeSelection = () => (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
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
              disabled={isConnecting || !connectionForm.name || !connectionForm.database}
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
          <Storage sx={{ fontSize: 48 }} />
        </Box>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {connectionForm.name}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
          Your database connection has been established successfully. You can now start querying your data with AI.
        </Typography>
        
        <Button
          variant="contained"
          onClick={() => window.location.reload()}
          sx={{ px: 4 }}
        >
          Start Querying
        </Button>
      </Paper>
    </Box>
  )

  return (
    <Box sx={{ p: 4, minHeight: '100vh', bgcolor: 'background.default' }}>
      {activeStep === 0 && renderTypeSelection()}
      {activeStep === 1 && renderConnectionForm()}
      {activeStep === 2 && renderSuccess()}
    </Box>
  )
} 