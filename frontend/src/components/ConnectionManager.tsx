import React, { useState, useEffect } from 'react';
import { X, Plus, Database, TestTube, Trash2, Settings, CheckCircle, XCircle, Loader } from 'lucide-react';

interface DatabaseConnection {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'sqlite' | 'mssql' | 'oracle' | 'snowflake' | 'redshift' | 'bigquery' | 'mariadb' | 'mongodb' | 'clickhouse';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  filepath?: string;
  ssl?: boolean;
  
  // Cloud-specific parameters
  account?: string; // For Snowflake
  warehouse?: string; // For Snowflake
  role?: string; // For Snowflake
  schema?: string; // For Snowflake/BigQuery
  project?: string; // For BigQuery
  dataset?: string; // For BigQuery
  keyFile?: string; // For BigQuery service account
  cluster?: string; // For Redshift
  region?: string; // For cloud databases
  
  // MongoDB specific
  authSource?: string;
  authMechanism?: string;
  
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ConnectionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionSelect?: (connectionId: string) => void;
}

export const ConnectionManager: React.FC<ConnectionManagerProps> = ({
  isOpen,
  onClose,
  onConnectionSelect
}) => {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'postgresql' as DatabaseConnection['type'],
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    filepath: '',
    ssl: false,
    isDefault: false,
    
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
    
    // MongoDB specific
    authSource: '',
    authMechanism: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadConnections();
    }
  }, [isOpen]);

  const loadConnections = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/connections');
      const data = await response.json();
      if (data.success) {
        setConnections(data.data);
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Test connection first
      const testResponse = await fetch('/api/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const testData = await testResponse.json();
      if (!testData.success) {
        alert(`Connection test failed: ${testData.error.message}`);
        return;
      }

      // Create connection if test passes
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      if (data.success) {
        setConnections([...connections, data.data]);
        setShowForm(false);
        resetForm();
      } else {
        alert(`Failed to create connection: ${data.error.message}`);
      }
    } catch (error) {
      console.error('Failed to create connection:', error);
      alert('Failed to create connection');
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async (connection: DatabaseConnection) => {
    setTestingConnection(connection.id);
    try {
      const response = await fetch('/api/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connection)
      });
      
      const data = await response.json();
      if (data.success) {
        alert('Connection test successful!');
      } else {
        alert(`Connection test failed: ${data.error.message}`);
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      alert('Connection test failed');
    } finally {
      setTestingConnection(null);
    }
  };

  const deleteConnection = async (id: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;
    
    try {
      const response = await fetch(`/api/connections/${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      if (data.success) {
        setConnections(connections.filter(c => c.id !== id));
      } else {
        alert(`Failed to delete connection: ${data.error.message}`);
      }
    } catch (error) {
      console.error('Failed to delete connection:', error);
      alert('Failed to delete connection');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: '',
      username: '',
      password: '',
      filepath: '',
      ssl: false,
      isDefault: false,
      
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
      
      // MongoDB specific
      authSource: '',
      authMechanism: ''
    });
  };

  const getPortForType = (type: string) => {
    switch (type) {
      case 'postgresql':
      case 'redshift': return 5432;
      case 'mysql':
      case 'mariadb': return 3306;
      case 'mssql': return 1433;
      case 'oracle': return 1521;
      case 'mongodb': return 27017;
      case 'clickhouse': return 9000;
      case 'snowflake': return 443;
      case 'bigquery': return 443;
      default: return 5432;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database size={24} />
            <h2 className="text-xl font-semibold">Connection Manager</h2>
          </div>
          <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Add Connection Button */}
          <div className="mb-6">
            <button
              onClick={() => setShowForm(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Plus size={18} />
              Add Connection
            </button>
          </div>

          {/* Connection Form */}
          {showForm && (
            <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h3 className="text-lg font-semibold mb-4">New Database Connection</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Connection Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Database Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => {
                        const type = e.target.value as DatabaseConnection['type'];
                        setFormData({ 
                          ...formData, 
                          type,
                          port: getPortForType(type)
                        });
                      }}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="postgresql">PostgreSQL</option>
                      <option value="mysql">MySQL</option>
                      <option value="sqlite">SQLite</option>
                      <option value="mssql">SQL Server</option>
                      <option value="oracle">Oracle</option>
                      <option value="snowflake">Snowflake</option>
                      <option value="redshift">Redshift</option>
                      <option value="bigquery">BigQuery</option>
                      <option value="mariadb">MariaDB</option>
                      <option value="mongodb">MongoDB</option>
                      <option value="clickhouse">ClickHouse</option>
                    </select>
                  </div>
                </div>

                {formData.type === 'sqlite' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Database File Path
                    </label>
                    <input
                      type="text"
                      value={formData.filepath}
                      onChange={(e) => setFormData({ ...formData, filepath: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      placeholder="/path/to/database.db"
                      required
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Host
                      </label>
                      <input
                        type="text"
                        value={formData.host}
                        onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Port
                      </label>
                      <input
                        type="number"
                        value={formData.port}
                        onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Database
                      </label>
                      <input
                        type="text"
                        value={formData.database}
                        onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                  </div>
                )}

                {formData.type !== 'sqlite' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                )}

                {/* Cloud-specific fields */}
                {formData.type === 'snowflake' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Account
                        </label>
                        <input
                          type="text"
                          value={formData.account}
                          onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-md"
                          placeholder="your-account.snowflakecomputing.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Warehouse
                        </label>
                        <input
                          type="text"
                          value={formData.warehouse}
                          onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-md"
                          placeholder="COMPUTE_WH"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Role (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="ACCOUNTADMIN"
                      />
                    </div>
                  </div>
                )}

                {formData.type === 'bigquery' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Project ID
                        </label>
                        <input
                          type="text"
                          value={formData.project}
                          onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-md"
                          placeholder="your-project-id"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Dataset
                        </label>
                        <input
                          type="text"
                          value={formData.dataset}
                          onChange={(e) => setFormData({ ...formData, dataset: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-md"
                          placeholder="your_dataset"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Service Account Key File (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.keyFile}
                        onChange={(e) => setFormData({ ...formData, keyFile: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="path/to/service-account.json"
                      />
                    </div>
                  </div>
                )}

                {formData.type === 'mongodb' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Auth Source (Optional)
                        </label>
                        <input
                          type="text"
                          value={formData.authSource}
                          onChange={(e) => setFormData({ ...formData, authSource: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-md"
                          placeholder="admin"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Auth Mechanism (Optional)
                        </label>
                        <select
                          value={formData.authMechanism}
                          onChange={(e) => setFormData({ ...formData, authMechanism: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-md"
                        >
                          <option value="">Default</option>
                          <option value="SCRAM-SHA-1">SCRAM-SHA-1</option>
                          <option value="SCRAM-SHA-256">SCRAM-SHA-256</option>
                          <option value="MONGODB-CR">MONGODB-CR</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cloud database region field */}
                {['snowflake', 'bigquery', 'redshift'].includes(formData.type) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Region (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      placeholder="us-west-2"
                    />
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.ssl}
                      onChange={(e) => setFormData({ ...formData, ssl: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">Use SSL</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isDefault}
                      onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">Set as default</span>
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isLoading ? 'Creating...' : 'Create Connection'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Connections List */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Existing Connections</h3>
            {isLoading && !showForm ? (
              <div className="text-center py-8">
                <Loader className="animate-spin mx-auto mb-2" size={24} />
                <p>Loading connections...</p>
              </div>
            ) : connections.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Database size={48} className="mx-auto mb-2 opacity-50" />
                <p>No connections configured</p>
              </div>
            ) : (
              connections.map((connection) => (
                <div
                  key={connection.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{connection.name}</h4>
                        {connection.isDefault && (
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        <p><strong>Type:</strong> {connection.type.toUpperCase()}</p>
                        {connection.type === 'sqlite' ? (
                          <p><strong>File:</strong> {connection.filepath}</p>
                        ) : (
                          <>
                            <p><strong>Host:</strong> {connection.host}:{connection.port}</p>
                            <p><strong>Database:</strong> {connection.database}</p>
                            <p><strong>Username:</strong> {connection.username}</p>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => testConnection(connection)}
                        disabled={testingConnection === connection.id}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                        title="Test Connection"
                      >
                        {testingConnection === connection.id ? (
                          <Loader className="animate-spin" size={16} />
                        ) : (
                          <TestTube size={16} />
                        )}
                      </button>
                      {onConnectionSelect && (
                        <button
                          onClick={() => onConnectionSelect(connection.id)}
                          className="p-2 text-green-600 hover:bg-green-100 rounded"
                          title="Use Connection"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteConnection(connection.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded"
                        title="Delete Connection"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 