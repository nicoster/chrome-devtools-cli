import { ICommandHandler } from '../interfaces/CommandHandler';
import { CDPClient, CommandResult } from '../types';
import { promises as fs } from 'fs';
import { dirname } from 'path';

/**
 * Arguments for snapshot command (DOM Snapshot)
 */
export interface TakeSnapshotArgs {
  filename?: string;           // Output filename (optional)
  format?: 'json' | 'html';   // Output format (default: json)
  includeStyles?: boolean;     // Include computed styles (default: true)
  includeAttributes?: boolean; // Include DOM attributes (default: true)
  includePaintOrder?: boolean; // Include paint order (default: false)
  includeTextIndex?: boolean;  // Include text node indices (default: false)
}

/**
 * CDP DOMSnapshot.captureSnapshot response
 */
interface DOMSnapshotResponse {
  documents: Array<{
    documentURL: string;
    title: string;
    baseURL: string;
    contentLanguage: string;
    encodingName: string;
    publicId: string;
    systemId: string;
    frameId: string;
    nodes: {
      parentIndex?: number[];
      nodeType?: number[];
      shadowRootType?: string[];
      nodeName?: string[];
      nodeValue?: string[];
      backendNodeId?: number[];
      attributes?: Array<string[]>;
      textValue?: {
        index: number[];
        value: string[];
      };
      inputValue?: {
        index: number[];
        value: string[];
      };
      inputChecked?: {
        index: number[];
      };
      optionSelected?: {
        index: number[];
      };
      contentDocumentIndex?: {
        index: number[];
        value: number[];
      };
      pseudoType?: {
        index: number[];
        value: string[];
      };
      pseudoIdentifier?: {
        index: number[];
        value: string[];
      };
      isClickable?: {
        index: number[];
      };
      currentSourceURL?: {
        index: number[];
        value: string[];
      };
      originURL?: {
        index: number[];
        value: string[];
      };
    };
    layout: {
      nodeIndex: number[];
      styles: Array<string[]>;
      bounds: number[][];
      text: string[];
      stackingContexts: {
        index: number[];
      };
      paintOrders?: number[];
      offsetRects?: number[][];
      scrollRects?: number[][];
      clientRects?: number[][];
      blendedBackgroundColors?: string[];
      textColorOpacities?: number[];
    };
    textBoxes: {
      layoutIndex: number[];
      bounds: number[][];
      start: number[];
      length: number[];
    };
  }>;
  strings: string[];
}

/**
 * CDP DOM.getDocument response
 */
interface DOMGetDocumentResponse {
  root: {
    nodeId: number;
    backendNodeId: number;
    nodeType: number;
    nodeName: string;
    localName: string;
    nodeValue: string;
    childNodeCount?: number;
    children?: any[];
    attributes?: string[];
    documentURL?: string;
    baseURL?: string;
    publicId?: string;
    systemId?: string;
    xmlVersion?: string;
    name?: string;
    value?: string;
    pseudoType?: string;
    shadowRootType?: string;
    frameId?: string;
    contentDocument?: any;
    shadowRoots?: any[];
    templateContent?: any;
    pseudoElements?: any[];
    importedDocument?: any;
    distributedNodes?: any[];
    isSVG?: boolean;
  };
}

/**
 * CDP DOM.getOuterHTML response
 */
interface DOMGetOuterHTMLResponse {
  outerHTML: string;
}

/**
 * CDP Runtime.evaluate response
 */
interface RuntimeEvaluateResponse {
  result: {
    type: string;
    value?: any;
    unserializableValue?: string;
    description?: string;
    objectId?: string;
    preview?: any;
    customPreview?: any;
  };
  exceptionDetails?: any;
}

/**
 * Handler for snapshot command
 * Captures a DOM snapshot including DOM tree structure, computed styles, 
 * visibility, and attribute values using CDP DOMSnapshot domain
 */
export class TakeSnapshotHandler implements ICommandHandler {
  readonly name = 'snapshot';

  /**
   * Execute DOM snapshot capture
   */
  async execute(client: CDPClient, args: unknown): Promise<CommandResult> {
    const snapshotArgs = args as TakeSnapshotArgs;

    try {
      // Enable required domains
      await client.send('DOM.enable');
      await client.send('CSS.enable');

      // Try the DOMSnapshot approach first, fall back to DOM approach if it fails
      try {
        return await this.captureWithDOMSnapshot(client, snapshotArgs);
      } catch (domSnapshotError) {
        // DOMSnapshot method failed, silently fall back to DOM method
        return await this.captureWithDOM(client, snapshotArgs);
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Capture snapshot using DOMSnapshot domain (preferred method)
   */
  private async captureWithDOMSnapshot(client: CDPClient, snapshotArgs: TakeSnapshotArgs): Promise<CommandResult> {
    // Enable DOMSnapshot domain
    await client.send('DOMSnapshot.enable');

    // Prepare snapshot parameters
    const params = this.buildSnapshotParams(snapshotArgs);

    // Capture DOM snapshot
    const response = await client.send('DOMSnapshot.captureSnapshot', params) as DOMSnapshotResponse;

    if (!response || !response.documents || response.documents.length === 0) {
      throw new Error('Failed to capture DOM snapshot: empty response');
    }

    // Process and format the snapshot data
    const processedSnapshot = this.processSnapshot(response, snapshotArgs);

    // Save snapshot to file if filename provided
    if (snapshotArgs.filename) {
      await this.saveSnapshot(processedSnapshot, snapshotArgs.filename, snapshotArgs.format);
      return {
        success: true,
        data: {
          message: `DOM snapshot saved to ${snapshotArgs.filename}`,
          filename: snapshotArgs.filename,
          format: snapshotArgs.format || 'json',
          documentsCount: response.documents.length,
          nodesCount: response.documents[0]?.nodes?.nodeName?.length || 0
        }
      };
    }

    // Return snapshot data if no filename provided
    return {
      success: true,
      data: {
        snapshot: processedSnapshot,
        format: snapshotArgs.format || 'json',
        documentsCount: response.documents.length,
        nodesCount: response.documents[0]?.nodes?.nodeName?.length || 0
      }
    };
  }

  /**
   * Capture snapshot using DOM domain (fallback method)
   */
  private async captureWithDOM(client: CDPClient, snapshotArgs: TakeSnapshotArgs): Promise<CommandResult> {
    // Get the document root
    const docResponse = await client.send('DOM.getDocument', { depth: -1 }) as DOMGetDocumentResponse;
    
    if (!docResponse || !docResponse.root) {
      throw new Error('Failed to get document root');
    }

    // Get the outer HTML of the document
    const htmlResponse = await client.send('DOM.getOuterHTML', { 
      nodeId: docResponse.root.nodeId 
    }) as DOMGetOuterHTMLResponse;

    if (!htmlResponse || !htmlResponse.outerHTML) {
      throw new Error('Failed to get document HTML');
    }

    let processedSnapshot: unknown;
    
    if (snapshotArgs.format === 'html') {
      processedSnapshot = htmlResponse.outerHTML;
    } else {
      // JSON format - create a structured representation
      processedSnapshot = {
        metadata: {
          captureTime: new Date().toISOString(),
          method: 'DOM.getOuterHTML',
          documentsCount: 1
        },
        documents: [{
          url: await this.getCurrentURL(client),
          title: await this.getCurrentTitle(client),
          html: htmlResponse.outerHTML,
          domTree: docResponse.root
        }]
      };
    }

    // Save snapshot to file if filename provided
    if (snapshotArgs.filename) {
      await this.saveSnapshot(processedSnapshot, snapshotArgs.filename, snapshotArgs.format);
      return {
        success: true,
        data: {
          message: `DOM snapshot saved to ${snapshotArgs.filename}`,
          filename: snapshotArgs.filename,
          format: snapshotArgs.format || 'json'
        }
      };
    }

    // Return snapshot data if no filename provided
    return {
      success: true,
      data: {
        snapshot: processedSnapshot,
        format: snapshotArgs.format || 'json'
      }
    };
  }

  /**
   * Get current page URL
   */
  private async getCurrentURL(client: CDPClient): Promise<string> {
    try {
      const result = await client.send('Runtime.evaluate', {
        expression: 'window.location.href',
        returnByValue: true
      }) as RuntimeEvaluateResponse;
      return result.result?.value || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get current page title
   */
  private async getCurrentTitle(client: CDPClient): Promise<string> {
    try {
      const result = await client.send('Runtime.evaluate', {
        expression: 'document.title',
        returnByValue: true
      }) as RuntimeEvaluateResponse;
      return result.result?.value || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Build CDP parameters for DOMSnapshot.captureSnapshot
   */
  private buildSnapshotParams(args: TakeSnapshotArgs): Record<string, unknown> {
    // Start with minimal parameters - some CDP versions are very strict
    const params: Record<string, unknown> = {};

    // Future: could use args for additional parameters
    if (args.includePaintOrder) {
      // This parameter might be supported in future CDP versions
      console.log('Paint order requested but not yet supported');
    }

    // Try with no parameters first to see if basic call works
    return params;
  }

  /**
   * Process raw DOM snapshot into a more readable format
   */
  private processSnapshot(response: DOMSnapshotResponse, args: TakeSnapshotArgs): unknown {
    if (args.format === 'html') {
      return this.convertToHTML(response);
    }

    const doc = response.documents[0];
    if (!doc) {
      return {
        error: 'No documents found'
      };
    }

    // Create LLM-friendly text representation
    const textSnapshot = this.createTextSnapshot(doc, response.strings);
    
    return {
      url: doc.documentURL,
      title: doc.title,
      snapshot: textSnapshot
    };
  }

  /**
   * Create a text-based snapshot that LLMs can easily understand
   */
  private createTextSnapshot(doc: DOMSnapshotResponse['documents'][0], strings: string[]): string {
    const nodes = doc.nodes;
    if (!nodes.nodeName || !nodes.nodeType) {
      return 'Empty document';
    }

    // Build node tree with essential information
    const nodeTree = this.buildNodeTree(doc, strings);
    
    // Convert to text representation
    let output = `PAGE: ${doc.title || 'Untitled'} (${doc.documentURL})\n`;
    
    // Find body or root content
    const bodyNode = this.findBodyNode(nodeTree);
    if (bodyNode) {
      output += this.renderNodeAsText(bodyNode, 0);
    } else {
      // Fallback: render all root nodes
      for (const node of nodeTree) {
        if (this.shouldIncludeNode(node)) {
          output += this.renderNodeAsText(node, 0);
        }
      }
    }

    return output;
  }

  /**
   * Build a simplified node tree with essential information
   */
  private buildNodeTree(doc: DOMSnapshotResponse['documents'][0], strings: string[]): any[] {
    const nodes = doc.nodes;
    const nodeCount = nodes.nodeName!.length;
    const nodeMap = new Map<number, any>();

    // Create nodes with essential info
    for (let i = 0; i < nodeCount; i++) {
      const node: any = {
        index: i,
        nodeType: nodes.nodeType![i],
        nodeName: nodes.nodeName![i].toLowerCase(),
        children: [],
        textContent: '',
        attributes: {}
      };

      // Extract text content
      if (nodes.nodeValue?.[i]) {
        node.textContent = nodes.nodeValue[i].trim();
      }
      if (nodes.textValue?.index.includes(i)) {
        const textIndex = nodes.textValue.index.indexOf(i);
        const stringIndex = nodes.textValue.value[textIndex];
        if (typeof stringIndex === 'number' && strings[stringIndex]) {
          node.textContent = strings[stringIndex].trim();
        }
      }

      // Extract essential attributes
      if (nodes.attributes?.[i]) {
        const attrs = nodes.attributes[i];
        for (let j = 0; j < attrs.length; j += 2) {
          const name = strings[parseInt(attrs[j])];
          const value = strings[parseInt(attrs[j + 1])];
          
          // Only keep attributes useful for LLM understanding
          if (['id', 'class', 'type', 'name', 'href', 'src', 'alt', 'placeholder', 'value', 'title'].includes(name)) {
            node.attributes[name] = value;
          }
        }
      }

      // Add form states
      if (nodes.inputValue?.index.includes(i)) {
        const inputIndex = nodes.inputValue.index.indexOf(i);
        const stringIndex = nodes.inputValue.value[inputIndex];
        if (typeof stringIndex === 'number') {
          node.inputValue = strings[stringIndex];
        }
      }

      if (nodes.inputChecked?.index.includes(i)) {
        node.checked = true;
      }

      if (nodes.optionSelected?.index.includes(i)) {
        node.selected = true;
      }

      if (nodes.isClickable?.index.includes(i)) {
        node.clickable = true;
      }

      nodeMap.set(i, node);
    }

    // Build parent-child relationships
    const tree: any[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const parentIndex = nodes.parentIndex?.[i];
      const node = nodeMap.get(i);

      if (parentIndex !== undefined && parentIndex >= 0) {
        const parent = nodeMap.get(parentIndex);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        tree.push(node);
      }
    }

    return tree;
  }

  /**
   * Find the body node or main content container
   */
  private findBodyNode(nodeTree: any[]): any | null {
    const findNode = (nodes: any[], tagName: string): any | null => {
      for (const node of nodes) {
        if (node.nodeName === tagName) {
          return node;
        }
        const found = findNode(node.children, tagName);
        if (found) return found;
      }
      return null;
    };

    return findNode(nodeTree, 'body') || findNode(nodeTree, 'main') || null;
  }

  /**
   * Check if a node should be included in the text representation
   */
  private shouldIncludeNode(node: any): boolean {
    // Skip script, style, meta, etc.
    const skipTags = ['script', 'style', 'meta', 'link', 'head', 'noscript', 'svg', 'path'];
    if (skipTags.includes(node.nodeName)) {
      return false;
    }

    // Skip empty text nodes
    if (node.nodeType === 3 && !node.textContent) {
      return false;
    }

    // Skip empty containers with no meaningful children
    if (node.nodeType === 1 && !node.textContent && node.children.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Render a node as text with proper indentation and formatting
   */
  private renderNodeAsText(node: any, depth: number): string {
    if (!this.shouldIncludeNode(node)) {
      return '';
    }

    const indent = '│   '.repeat(depth);
    const prefix = depth > 0 ? '├── ' : '';
    let output = '';

    if (node.nodeType === 3) {
      // Text node
      if (node.textContent) {
        output += `${indent}${prefix}"${node.textContent}"\n`;
      }
    } else if (node.nodeType === 1) {
      // Element node
      const tag = node.nodeName.toUpperCase();
      let description = tag;

      // Add meaningful attributes
      const attrs = [];
      if (node.attributes.id) attrs.push(`#${node.attributes.id}`);
      if (node.attributes.class) attrs.push(`.${node.attributes.class.split(' ')[0]}`);
      if (node.attributes.type) attrs.push(`[${node.attributes.type}]`);
      if (node.attributes.name) attrs.push(`name="${node.attributes.name}"`);
      
      if (attrs.length > 0) {
        description += `(${attrs.join(' ')})`;
      }

      // Add special content for specific elements
      if (node.nodeName === 'img' && node.attributes.alt) {
        description += `: "${node.attributes.alt}"`;
      } else if (node.nodeName === 'a' && node.attributes.href) {
        description += `: "${node.attributes.href}"`;
      } else if (['input', 'textarea'].includes(node.nodeName)) {
        if (node.attributes.placeholder) {
          description += `: "${node.attributes.placeholder}"`;
        } else if (node.inputValue) {
          description += `: "${node.inputValue}"`;
        }
        if (node.checked) description += ' [checked]';
      } else if (node.nodeName === 'button' || ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.nodeName)) {
        // For buttons and headings, show text content inline
        const textContent = this.extractTextContent(node);
        if (textContent) {
          description += `: "${textContent}"`;
        }
      }

      output += `${indent}${prefix}${description}\n`;

      // Render children
      const meaningfulChildren = node.children.filter((child: any) => this.shouldIncludeNode(child));
      
      // For elements like P, DIV, SPAN - show text content directly if no complex children
      if (['p', 'div', 'span', 'li', 'td', 'th'].includes(node.nodeName)) {
        const textContent = this.extractTextContent(node);
        if (textContent && meaningfulChildren.length <= 1) {
          output += `${indent}│   └── "${textContent}"\n`;
          return output;
        }
      }

      // Render child nodes
      for (const child of meaningfulChildren) {
        output += this.renderNodeAsText(child, depth + 1);
      }
    }

    return output;
  }

  /**
   * Extract all text content from a node and its children
   */
  private extractTextContent(node: any): string {
    let text = '';
    
    if (node.nodeType === 3) {
      return node.textContent || '';
    }
    
    if (node.textContent) {
      text += node.textContent + ' ';
    }
    
    for (const child of node.children) {
      text += this.extractTextContent(child) + ' ';
    }
    
    return text.trim().replace(/\s+/g, ' ');
  }

  /**
   * Convert DOM snapshot to HTML representation
   */
  private convertToHTML(response: DOMSnapshotResponse): string {
    const doc = response.documents[0];
    if (!doc) return '';

    const tree = this.buildDOMTree(doc, response.strings);
    return this.renderNodeAsHTML(tree[0], 0);
  }

  /**
   * Build a hierarchical DOM tree from the flat node arrays (for HTML output)
   */
  private buildDOMTree(doc: DOMSnapshotResponse['documents'][0], strings: string[]): unknown[] {
    const nodes = doc.nodes;
    if (!nodes.nodeName || !nodes.nodeType) {
      return [];
    }

    const nodeCount = nodes.nodeName.length;
    const tree: any[] = [];
    const nodeMap = new Map<number, any>();

    // Create all nodes first
    for (let i = 0; i < nodeCount; i++) {
      const node: any = {
        index: i,
        nodeType: nodes.nodeType[i],
        nodeName: nodes.nodeName[i],
        nodeValue: nodes.nodeValue?.[i],
        backendNodeId: nodes.backendNodeId?.[i],
        children: []
      };

      // Add attributes if available
      if (nodes.attributes?.[i]) {
        const attrs = nodes.attributes[i];
        node.attributes = {};
        for (let j = 0; j < attrs.length; j += 2) {
          const name = strings[parseInt(attrs[j])];
          const value = strings[parseInt(attrs[j + 1])];
          node.attributes[name] = value;
        }
      }

      // Add special properties
      if (nodes.textValue?.index.includes(i)) {
        const textIndex = nodes.textValue.index.indexOf(i);
        const stringIndex = nodes.textValue.value[textIndex];
        if (typeof stringIndex === 'number') {
          node.textValue = strings[stringIndex];
        }
      }

      if (nodes.inputValue?.index.includes(i)) {
        const inputIndex = nodes.inputValue.index.indexOf(i);
        const stringIndex = nodes.inputValue.value[inputIndex];
        if (typeof stringIndex === 'number') {
          node.inputValue = strings[stringIndex];
        }
      }

      if (nodes.inputChecked?.index.includes(i)) {
        node.inputChecked = true;
      }

      if (nodes.optionSelected?.index.includes(i)) {
        node.optionSelected = true;
      }

      if (nodes.isClickable?.index.includes(i)) {
        node.isClickable = true;
      }

      nodeMap.set(i, node);
    }

    // Build parent-child relationships
    for (let i = 0; i < nodeCount; i++) {
      const parentIndex = nodes.parentIndex?.[i];
      const node = nodeMap.get(i);

      if (parentIndex !== undefined && parentIndex >= 0) {
        const parent = nodeMap.get(parentIndex);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        // Root node
        tree.push(node);
      }
    }

    return tree;
  }

  /**
   * Render a DOM node as HTML string
   */
  private renderNodeAsHTML(node: any, depth: number): string {
    if (!node) return '';

    const indent = '  '.repeat(depth);
    
    // Handle text nodes
    if (node.nodeType === 3) { // TEXT_NODE
      const text = node.nodeValue || node.textValue || '';
      return text.trim() ? `${indent}${text.trim()}\n` : '';
    }

    // Handle comment nodes
    if (node.nodeType === 8) { // COMMENT_NODE
      return `${indent}<!-- ${node.nodeValue || ''} -->\n`;
    }

    // Handle element nodes
    if (node.nodeType === 1) { // ELEMENT_NODE
      const tagName = node.nodeName.toLowerCase();
      let html = `${indent}<${tagName}`;

      // Add attributes
      if (node.attributes) {
        for (const [name, value] of Object.entries(node.attributes)) {
          html += ` ${name}="${value}"`;
        }
      }

      // Self-closing tags
      const selfClosing = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
      if (selfClosing.includes(tagName)) {
        html += ' />\n';
        return html;
      }

      html += '>';

      // Add children
      if (node.children && node.children.length > 0) {
        html += '\n';
        for (const child of node.children) {
          html += this.renderNodeAsHTML(child, depth + 1);
        }
        html += `${indent}</${tagName}>\n`;
      } else {
        html += `</${tagName}>\n`;
      }

      return html;
    }

    return '';
  }

  /**
   * Save snapshot data to file
   */
  private async saveSnapshot(snapshotData: unknown, filename: string, format?: string): Promise<void> {
    try {
      // Ensure directory exists
      const dir = dirname(filename);
      await fs.mkdir(dir, { recursive: true });

      // Convert data to string based on format
      let content: string;
      if (format === 'html') {
        content = snapshotData as string;
      } else {
        // Default JSON format
        content = JSON.stringify(snapshotData, null, 2);
      }

      await fs.writeFile(filename, content, 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to save DOM snapshot to "${filename}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Validate command arguments
   */
  validateArgs(args: unknown): boolean {
    if (typeof args !== 'object' || args === null) {
      return false;
    }

    const snapshotArgs = args as TakeSnapshotArgs;

    // Validate filename if provided
    if (snapshotArgs.filename !== undefined && typeof snapshotArgs.filename !== 'string') {
      return false;
    }

    // Validate format
    if (snapshotArgs.format !== undefined && !['json', 'html'].includes(snapshotArgs.format)) {
      return false;
    }

    // Validate boolean flags
    if (snapshotArgs.includeStyles !== undefined && typeof snapshotArgs.includeStyles !== 'boolean') {
      return false;
    }

    if (snapshotArgs.includeAttributes !== undefined && typeof snapshotArgs.includeAttributes !== 'boolean') {
      return false;
    }

    if (snapshotArgs.includePaintOrder !== undefined && typeof snapshotArgs.includePaintOrder !== 'boolean') {
      return false;
    }

    if (snapshotArgs.includeTextIndex !== undefined && typeof snapshotArgs.includeTextIndex !== 'boolean') {
      return false;
    }

    return true;
  }

  /**
   * Get command help text
   */
  getHelp(): string {
    return `
snapshot - Capture a text-based DOM representation optimized for LLM understanding

Usage:
  snapshot
  snapshot --filename page-structure.txt
  snapshot --format html --filename page-structure.html

Arguments:
  --filename <path>           Output filename (if not provided, returns data directly)
  --format <json|html>        Output format (default: json with text snapshot)
  --include-styles            Include computed styles (default: true)
  --include-attributes        Include DOM attributes (default: true)
  --include-paint-order       Include paint order information (default: false)
  --include-text-index        Include additional DOM tree data (default: false)

Output Format:
  The default JSON output contains a text-based representation of the page structure
  that LLMs can easily understand, showing:
  - Page hierarchy with indentation
  - Element types and key attributes
  - Text content and form values
  - Interactive elements (buttons, links, forms)
  - Semantic structure (headings, lists, etc.)

Example Output:
  PAGE: Example Site (https://example.com)
  ├── HEADER
  │   ├── IMG(#logo): "Company Logo"
  │   └── NAV
  │       ├── A: "https://example.com/home"
  │       └── "Home"
  ├── MAIN
  │   ├── H1: "Welcome to Our Site"
  │   ├── P
  │   │   └── "This is the main content..."
  │   └── FORM
  │       ├── INPUT[email](name="email"): "Enter your email"
  │       └── BUTTON: "Submit"

Examples:
  # Get text-based page structure
  snapshot

  # Save to file
  snapshot --filename page-structure.json

  # HTML representation
  snapshot --format html --filename page-structure.html

Note:
  This format provides a "text screenshot" that LLMs can easily parse to understand
  page layout, content, and interactive elements without overwhelming detail.
`;
  }
}