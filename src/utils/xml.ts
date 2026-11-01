import { XMLParser } from 'fast-xml-parser';

// parseTagValue: false keeps suggestion terms like "2048" or "007" as strings.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'label',
  parseTagValue: false,
});

export function parseXml<T = any>(xml: string): T {
  return parser.parse(xml) as T;
}

