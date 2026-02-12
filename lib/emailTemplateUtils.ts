/**
 * Email template utility functions for variable replacement
 */

export interface EmailTemplateData {
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  quoteName?: string;
  quoteNumber?: string;
  quoteDate?: string;
  quoteTotal?: string;
  projectName?: string;
  projectAddress?: string;
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
  userName?: string;
  currentDate?: string;
  [key: string]: string | undefined;
}

/**
 * Replaces template variables in a string with actual values
 * Variables are in the format {variableName}
 * 
 * @param template - The template string with variables
 * @param data - Object containing variable values
 * @returns The template with variables replaced
 */
export function replaceEmailVariables(
  template: string,
  data: EmailTemplateData
): string {
  if (!template) return '';
  
  let result = template;
  
  // Replace each variable in the format {variableName}
  Object.keys(data).forEach((key) => {
    const value = data[key];
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, value || `{${key}}`);
  });
  
  return result;
}

/**
 * Gets a list of all variables used in a template
 * @param template - The template string
 * @returns Array of variable names found in the template
 */
export function extractTemplateVariables(template: string): string[] {
  if (!template) return [];
  
  const regex = /\{([^}]+)\}/g;
  const matches: string[] = [];
  let match;
  
  while ((match = regex.exec(template)) !== null) {
    if (!matches.includes(match[1])) {
      matches.push(match[1]);
    }
  }
  
  return matches;
}

/**
 * Validates that all required variables in a template have values
 * @param template - The template string
 * @param data - Object containing variable values
 * @returns Array of missing variable names
 */
export function getMissingVariables(
  template: string,
  data: EmailTemplateData
): string[] {
  const variables = extractTemplateVariables(template);
  const missing: string[] = [];
  
  variables.forEach((variable) => {
    if (!data[variable] || data[variable] === '') {
      missing.push(variable);
    }
  });
  
  return missing;
}

/**
 * Gets common email template data from client and quote objects
 */
export function getCommonTemplateData(
  client?: any,
  quote?: any,
  project?: any,
  user?: any
): EmailTemplateData {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  return {
    clientName: client?.name || '',
    clientEmail: client?.email || '',
    clientPhone: client?.phone || '',
    clientAddress: client?.address || '',
    quoteName: quote?.name || '',
    quoteNumber: quote?.id || '',
    quoteDate: quote?.date ? new Date(quote.date).toLocaleDateString() : '',
    quoteTotal: quote?.total ? `$${quote.total.toFixed(2)}` : '',
    projectName: project?.name || '',
    projectAddress: project?.address || '',
    companyName: 'SolarFlux',
    companyEmail: 'info@solarflux.com',
    companyPhone: '(555) 123-4567',
    userName: user?.nickname || user?.username || '',
    currentDate,
  };
}

/**
 * Gets available variables for a specific template category
 */
export function getAvailableVariablesForCategory(
  category: 'quote' | 'invoice' | 'general' | 'project'
): string[] {
  const common = [
    'clientName',
    'clientEmail',
    'clientPhone',
    'companyName',
    'companyEmail',
    'companyPhone',
    'userName',
    'currentDate',
  ];
  
  switch (category) {
    case 'quote':
      return [
        ...common,
        'quoteName',
        'quoteNumber',
        'quoteDate',
        'quoteTotal',
      ];
    case 'invoice':
      return [
        ...common,
        'quoteName',
        'quoteNumber',
        'quoteDate',
        'quoteTotal',
      ];
    case 'project':
      return [
        ...common,
        'projectName',
        'projectAddress',
        'clientAddress',
      ];
    case 'general':
      return common;
    default:
      return common;
  }
}

/**
 * Creates a default email template for a category
 */
export function createDefaultTemplate(
  category: 'quote' | 'invoice' | 'general' | 'project'
): { subject: string; body: string; variables: string[] } {
  const variables = getAvailableVariablesForCategory(category);
  
  switch (category) {
    case 'quote':
      return {
        subject: 'Quote from {companyName} - {quoteName}',
        body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #2563eb;">Quote from {companyName}</h2>
  <p>Dear {clientName},</p>
  <p>Thank you for your interest in our solar solutions. Please find attached your personalized quote for <strong>{quoteName}</strong>.</p>
  <p>If you have any questions or would like to discuss the details, please don't hesitate to contact us.</p>
  <br/>
  <p>Best regards,<br/>
  <strong>{userName}</strong><br/>
  {companyName}</p>
</div>
        `.trim(),
        variables,
      };
    case 'invoice':
      return {
        subject: 'Invoice from {companyName} - {quoteName}',
        body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #2563eb;">Invoice from {companyName}</h2>
  <p>Dear {clientName},</p>
  <p>Please find attached your invoice for <strong>{quoteName}</strong>.</p>
  <p>Total Amount: {quoteTotal}</p>
  <p>If you have any questions regarding this invoice, please contact us.</p>
  <br/>
  <p>Best regards,<br/>
  <strong>{userName}</strong><br/>
  {companyName}</p>
</div>
        `.trim(),
        variables,
      };
    case 'project':
      return {
        subject: 'Project Update - {projectName}',
        body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #2563eb;">Project Update</h2>
  <p>Dear {clientName},</p>
  <p>We wanted to provide you with an update on your project: <strong>{projectName}</strong></p>
  <p>Project Address: {projectAddress}</p>
  <p>If you have any questions, please don't hesitate to reach out.</p>
  <br/>
  <p>Best regards,<br/>
  <strong>{userName}</strong><br/>
  {companyName}</p>
</div>
        `.trim(),
        variables,
      };
    case 'general':
      return {
        subject: 'Message from {companyName}',
        body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #2563eb;">Hello from {companyName}</h2>
  <p>Dear {clientName},</p>
  <p>[Your message here]</p>
  <br/>
  <p>Best regards,<br/>
  <strong>{userName}</strong><br/>
  {companyName}</p>
</div>
        `.trim(),
        variables,
      };
    default:
      return {
        subject: 'Message from {companyName}',
        body: '<p>[Your message here]</p>',
        variables,
      };
  }
}
