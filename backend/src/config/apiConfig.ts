export interface APIConfig {
  huggingFace: {
    apiKey?: string;
    baseUrl: string;
    models: string[];
    rateLimit: number;
  };
  openai: {
    apiKey?: string;
    baseUrl: string;
    model: string;
    rateLimit: number;
  };
  anthropic: {
    apiKey?: string;
    baseUrl: string;
    model: string;
    rateLimit: number;
  };
  google: {
    apiKey?: string;
    baseUrl: string;
    model: string;
    rateLimit: number;
  };
}

export const defaultAPIConfig: APIConfig = {
  huggingFace: {
    apiKey: process.env.HUGGINGFACE_API_KEY,
    baseUrl: 'https://api-inference.huggingface.co/models',
    models: [
      'defog/sqlcoder-7b-2',
      'Salesforce/codet5p-770m',
      'microsoft/DialoGPT-medium'
    ],
    rateLimit: 1000 // requests per hour for free tier
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
    rateLimit: 3500 // requests per minute
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-haiku-20240307',
    rateLimit: 1000 // requests per minute
  },
  google: {
    apiKey: process.env.GOOGLE_API_KEY,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-pro',
    rateLimit: 60 // requests per minute for free tier
  }
};

export const getAPIConfig = (): APIConfig => {
  return {
    ...defaultAPIConfig,
    // Override with environment variables if available
    huggingFace: {
      ...defaultAPIConfig.huggingFace,
      apiKey: process.env.HUGGINGFACE_API_KEY || defaultAPIConfig.huggingFace.apiKey
    },
    openai: {
      ...defaultAPIConfig.openai,
      apiKey: process.env.OPENAI_API_KEY || defaultAPIConfig.openai.apiKey
    },
    anthropic: {
      ...defaultAPIConfig.anthropic,
      apiKey: process.env.ANTHROPIC_API_KEY || defaultAPIConfig.anthropic.apiKey
    },
    google: {
      ...defaultAPIConfig.google,
      apiKey: process.env.GOOGLE_API_KEY || defaultAPIConfig.google.apiKey
    }
  };
};

export const validateAPIConfig = (config: APIConfig): { isValid: boolean; missingKeys: string[] } => {
  const missingKeys: string[] = [];
  
  if (!config.huggingFace.apiKey) {
    missingKeys.push('HUGGINGFACE_API_KEY');
  }
  if (!config.openai.apiKey) {
    missingKeys.push('OPENAI_API_KEY');
  }
  if (!config.anthropic.apiKey) {
    missingKeys.push('ANTHROPIC_API_KEY');
  }
  if (!config.google.apiKey) {
    missingKeys.push('GOOGLE_API_KEY');
  }
  
  return {
    isValid: missingKeys.length === 0,
    missingKeys
  };
};